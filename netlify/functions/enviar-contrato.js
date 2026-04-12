import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { pdfBase64, email, telefone, nome, placa, tipoContrato } = JSON.parse(event.body || '{}');

    if (!email || !pdfBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email e pdfBase64 são obrigatórios' }) };
    }

    // Salvar lead no Supabase
    await supabase.from('leads_contratos').upsert({
      nome: nome || null,
      email: email.toLowerCase(),
      telefone: telefone || null,
      placa: placa || null,
      tipo_contrato: tipoContrato || null,
      created_at: new Date().toISOString()
    });

    // Enviar email com PDF anexado via MailerSend
    const mailerKey = process.env.MAILERSEND_API_KEY;
    if (!mailerKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'MAILERSEND_API_KEY não configurada' }) };
    }

    const nomeArquivo = tipoContrato === 'reserva_dominio'
      ? 'CONTRATO RESERVA DE DOMINIO.pdf'
      : 'CONTRATO DE COMPRA E VENDA.pdf';

    const mailerResponse = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailerKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: 'contratos@icarsp.com.br', name: 'iCarSP' },
        reply_to: { email: 'contato@icarsp.com.br', name: 'iCarSP' },
        to: [{ email: email, name: nome || email }],
        subject: `Seu contrato iCarSP — ${placa || 'Veículo'}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;">
            <h2 style="color:#b45309;">iCarSP — Serviços Automotivos</h2>
            <p>Olá${nome ? ', ' + nome : ''}!</p>
            <p>Segue em anexo o seu contrato gerado pela plataforma iCarSP.</p>
            <p style="background:#fef3c7;border-left:4px solid #d97706;padding:12px;border-radius:4px;">
              <strong>Guarde este arquivo!</strong> Ele tem validade jurídica nos termos do Código Civil Brasileiro.
            </p>
            <p style="color:#666;font-size:0.85rem;margin-top:24px;">
              iCarSP — Despachante Documentalista CRDD 005636-7<br>
              contato@icarsp.com.br | www.icarsp.com.br
            </p>
          </div>
        `,
        attachments: [
          {
            filename: nomeArquivo,
            content: pdfBase64,
            disposition: 'attachment'
          }
        ]
      })
    });

    if (!mailerResponse.ok) {
      const err = await mailerResponse.json();
      console.error('Erro MailerSend:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao enviar email', details: err }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Email enviado com sucesso' })
    };

  } catch (error) {
    console.error('Erro em enviar-contrato:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno', details: error.message }) };
  }
}
