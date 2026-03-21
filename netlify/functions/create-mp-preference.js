import crypto from 'crypto';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { placa, email } = JSON.parse(event.body || '{}');

    if (!placa) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Placa obrigatória' }) };
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const siteUrl = process.env.SITE_URL;

    if (!accessToken || !siteUrl) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuração incompleta do servidor' }) };
    }

    const placaNormalizada = String(placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const preference = {
      items: [{
        id: 'consulta-veicular',
        title: `Consulta Veicular - Placa ${placaNormalizada}`,
        quantity: 1,
        unit_price: 19.99,
        currency_id: 'BRL'
      }],
      payer: {
        email: email || 'cliente@icarsp.com.br'
      },
      back_urls: {
        success: `${siteUrl}/resultado.html`,
        failure: `${siteUrl}/?erro=pagamento`,
        pending: `${siteUrl}/resultado.html`
      },
      auto_return: 'approved',
      external_reference: placaNormalizada,
      notification_url: `${siteUrl}/.netlify/functions/mp-webhook`,
      statement_descriptor: 'ICARSP'
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(preference)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Erro ao criar preferência de pagamento', details: mpData })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        preferenceId: mpData.id,
        init_point: mpData.init_point
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno', details: error.message })
    };
  }
}
