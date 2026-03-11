import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (event) => {
  try {
    const { placa } = JSON.parse(event.body);
    const token = process.env.MP_ACCESS_TOKEN;

    const payload = {
      transaction_amount: 14.99,  // ✅ VALOR CORRETO
      description: `Consulta placa ${placa} - iCarSP`,
      payment_method_id: 'pix',
      payer: { email: 'cliente@email.com' }
    };

    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': uuidv4()
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ erro: data })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: err.message })
    };
  }
};