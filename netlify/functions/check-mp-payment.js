import fetch from 'node-fetch';

export const handler = async (event) => {
  try {
    const paymentId = event.queryStringParameters?.payment_id;
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Access Token não configurado' })
      };
    }

    if (!paymentId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'payment_id não informado' })
      };
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${payment
...(truncated)...