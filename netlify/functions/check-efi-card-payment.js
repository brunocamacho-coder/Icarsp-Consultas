import https from 'https';

const EFI_BASE = process.env.EFI_SANDBOX === 'true'
  ? 'https://sandbox.gerencianet.com.br'
  : 'https://api.gerencianet.com.br';

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      ...options,
    }, (res) => {
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
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const chargeId = event.queryStringParameters?.payment_id;
  if (!chargeId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'payment_id obrigatório' }) };
  }

  try {
    const token = await getToken();

    const res = await httpsRequest(`${EFI_BASE}/v1/charge/${chargeId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`EFI check card error: ${JSON.stringify(res.data)}`);

    const status = res.data.data?.status || res.data.status || 'waiting';
    const pago = status === 'paid';

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
      body: JSON.stringify({ success: true, payment_id: chargeId, status, pago }),
    };
  } catch (error) {
    console.error('Erro check-efi-card-payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao verificar pagamento', details: error.message }),
    };
  }
}
