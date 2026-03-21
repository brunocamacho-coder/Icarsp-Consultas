import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { placa, ...formData } = body;

    if (!placa) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Placa obrigatória' }) };
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const siteUrl = process.env.SITE_URL;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!accessToken || !siteUrl) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuração incompleta do servidor' }) };
    }

    const placaNormalizada = String(placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const payload = {
      ...formData,
      transaction_amount: 14.99,
      description: `Consulta veicular placa ${placaNormalizada}`,
      external_reference: placaNormalizada,
      notification_url: `${siteUrl}/.netlify/functions/mp-webhook`
    };

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      return {
        statusCode: mpResponse.status === 429 ? 429 : 500,
        body: JSON.stringify({ error: mpData.message || 'Erro ao processar pagamento', details: mpData })
      };
    }

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('vehicle_reports').upsert({
        payment_id: String(mpData.id),
        placa: placaNormalizada,
        status: mpData.status || 'pending',
        customer_email: formData.payer?.email || null,
        updated_at: new Date().toISOString()
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify(mpData)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno', details: error.message })
    };
  }
}
