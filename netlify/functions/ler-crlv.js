export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body || '{}');

    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Imagem não enviada' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }) };
    }

    // Monta o conteúdo baseado no tipo de arquivo
    const isPDF = mediaType === 'application/pdf';
    
    const content = [
      isPDF ? {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: imageBase64
        }
      } : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType || 'image/jpeg',
          data: imageBase64
        }
      },
      {
        type: 'text',
        text: `Você é um especialista em documentos veiculares brasileiros. Analise este documento CRLV (Certificado de Registro e Licenciamento de Veículo) e extraia os dados. Retorne APENAS um JSON válido, sem markdown, sem explicações, sem texto adicional. Se não conseguir ler algum campo, deixe como string vazia "".

Formato exato do JSON:
{
  "placa": "",
  "marca_modelo": "",
  "ano_fabricacao": "",
  "ano_modelo": "",
  "cor": "",
  "combustivel": "",
  "chassi": "",
  "renavam": ""
}`
      }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro API Anthropic:', JSON.stringify(error));
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Erro na API Anthropic', details: error })
      };
    }

    const data = await response.json();
    const texto = data.content?.[0]?.text || '{}';
    console.log('Resposta IA:', texto);

    let dadosVeiculo;
    try {
      dadosVeiculo = JSON.parse(texto.replace(/```json|```/g, '').trim());
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Erro ao interpretar resposta da IA', raw: texto })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, dados: dadosVeiculo })
    };

  } catch (error) {
    console.error('Erro na função ler-crlv:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno', details: error.message })
    };
  }
}