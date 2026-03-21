import https from 'https';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const EFI_BASE_URL = 'https://pix.api.efipay.com.br';

async function getCertBuffer(supabase) {
  const { data, error } = await supabase.storage.from('certs').download('efi.p12');
  if (error) throw new Error(`Erro ao baixar certificado: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

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
          const json = JSON.parse(raw);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
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

async function getToken(agent) {
  const credentials = Buffer.from(
    `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
  ).toString('base64');

  const res = await httpsRequest(`${EFI_BASE_URL}/oauth/token`, {
    method: 'POST',
    agent,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  }, JSON.stringify({ grant_type: 'client_credentials' }));

  if (!res.ok) throw new Error(`Erro ao obter token Efí: ${JSON.stringify(res.data)}`);
  return res.data.access_token;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { placa, email } = JSON.parse(event.body || '{}');
    if (!placa) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Placa obrigatória' }) };
    }

    const placaNormalizada = String(placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const txid = crypto.randomUUID().replace(/-/g, '');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const certBuf = await getCertBuffer(supabase);
    const agent = new https.Agent({ pfx: certBuf, passphrase: '' });
    const token = await getToken(agent);

    const cobPayload = {
      calendario: { expiracao: 3600 },
      valor: { original: '14.99' },
      chave: process.env.EFI_PIX_KEY,
      solicitacaoPagador: `Consulta veicular placa ${placaNormalizada}`,
    };

    const cobRes = await httpsRequest(`${EFI_BASE_URL}/v2/cob/${txid}`, {
      method: 'PUT',
      agent,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, JSON.stringify(cobPayload));

    if (!cobRes.ok) throw new Error(`Efí cob error: ${JSON.stringify(cobRes.data)}`);

    await supabase.from('vehicle_reports').upsert({
      payment_id: txid,
      placa: placaNormalizada,
      status: 'pending',
      customer_email: email || null,
      updated_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        paymentId: txid,
        payment_id: txid,
        status: 'pending',
        qr_code: cobRes.data.pixCopiaECola,
        pix_copia_e_cola: cobRes.data.pixCopiaECola,
      }),
    };
  } catch (error) {
    console.error('Erro create-efi-payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao criar pagamento PIX', details: error.message }),
    };
  }
}
