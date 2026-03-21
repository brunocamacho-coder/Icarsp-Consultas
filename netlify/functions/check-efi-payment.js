import https from 'https';
import { createClient } from '@supabase/supabase-js';

const EFI_BASE_URL = 'https://pix.api.efipay.com.br';

async function getCertBuffer() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const txid = event.queryStringParameters?.payment_id;
  const tipo = event.queryStringParameters?.tipo || '';

  if (!txid) {
    return { statusCode: 400, body: JSON.stringify({ error: 'payment_id obrigatório' }) };
  }

  try {
    const certBuf = await getCertBuffer();
    const agent = new https.Agent({ pfx: certBuf, passphrase: '' });
    const token = await getToken(agent);

    const res = await httpsRequest(`${EFI_BASE_URL}/v2/cob/${txid}`, {
      method: 'GET',
      agent,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Efí check error: ${JSON.stringify(res.data)}`);

    const status = res.data.status || 'ATIVA';
    const pago = status === 'CONCLUIDA';

    const isContrato = tipo === 'contrato' || tipo === 'contrato_reserva';
    if (pago && !isContrato) {
      try {
        await fetch(`${process.env.SITE_URL}/.netlify/functions/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: txid }),
        });
      } catch (e) {
        console.error('Erro ao disparar generate-report:', e);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, payment_id: txid, status, pago }),
    };
  } catch (error) {
    console.error('Erro check-efi-payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao verificar pagamento', details: error.message }),
    };
  }
}
