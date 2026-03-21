import https from 'https';
import { createClient } from '@supabase/supabase-js';

const EFI_BASE = process.env.EFI_SANDBOX === 'true'
  ? 'https://sandbox.gerencianet.com.br'
  : 'https://api.gerencianet.com.br';

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      ...options,
    };
    const req = https.request(reqOptions, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(raw) });
        } catch (e) {
          reject(new Error(`Erro ao parsear resposta EFI: ${raw}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getToken() {
  const credentials = Buffer.from(`${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`).toString('base64');
  const res = await httpsRequest(`${EFI_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  }, JSON.stringify({ grant_type: 'client_credentials' }));
  if (!res.ok) throw new Error(`Erro ao obter token EFI: ${JSON.stringify(res.data)}`);
  return res.data.access_token;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const {
      placa,
      payment_token,
      customer_name,
      customer_cpf,
      customer_email,
      customer_phone,
      customer_birth,
      billing_street,
      billing_number,
      billing_neighborhood,
      billing_zipcode,
      billing_city,
      billing_state,
    } = JSON.parse(event.body || '{}');

    if (!placa || !payment_token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados obrigatórios ausentes' }) };
    }

    const placaNormalizada = String(placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const token = await getToken();

    const chargePayload = {
      items: [{
        name: `Consulta veicular placa ${placaNormalizada}`,
        value: 1499,
        amount: 1,
      }],
      payment: {
        credit_card: {
          installments: 1,
          payment_token,
          billing_address: {
            street: billing_street,
            number: billing_number,
            neighborhood: billing_neighborhood,
            zipcode: billing_zipcode,
            city: billing_city,
            state: billing_state,
          },
          customer: {
            name: customer_name,
            cpf: customer_cpf,
            email: customer_email,
            phone_number: customer_phone,
            birth: customer_birth,
          },
        },
      },
    };

    const chargeRes = await httpsRequest(`${EFI_BASE}/v1/charge/one-step`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, JSON.stringify(chargePayload));

    if (!chargeRes.ok) {
      throw new Error(`EFI card charge error: ${JSON.stringify(chargeRes.data)}`);
    }

    const chargeData = chargeRes.data.data || chargeRes.data;
    const chargeId = String(chargeData.charge_id);
    const status = chargeData.status || 'waiting';
    const pago = status === 'paid';

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('vehicle_reports').upsert({
      payment_id: chargeId,
      placa: placaNormalizada,
      status: pago ? 'paid' : 'pending',
      customer_email: customer_email || null,
      updated_at: new Date().toISOString(),
    });

    if (pago) {
      try {
        await fetch(`${process.env.SITE_URL}/.netlify/functions/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: chargeId }),
        });
      } catch (e) {
        console.error('Erro ao disparar generate-report:', e);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, paymentId: chargeId, status, pago }),
    };
  } catch (error) {
    console.error('Erro create-efi-card-payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao processar pagamento', details: error.message }),
    };
  }
}
