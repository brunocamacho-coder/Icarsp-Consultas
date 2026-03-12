export async function handler(event) {
try {
const accessToken = process.env.MP_ACCESS_TOKEN;
const siteUrl = process.env.SITE_URL;

let paymentId = null;

if (event.httpMethod === 'POST') {
const body = JSON.parse(event.body || '{}');
paymentId = body?.data?.id || body?.id || null;
}

if (!paymentId && event.queryStringParameters) {
paymentId =
event.queryStringParameters['data.id'] ||
event.queryStringParameters.id ||
null;
}

if (!paymentId) {
return {
statusCode: 200,
body: JSON.stringify({ received: true, ignored: true })
};
}

const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
method: 'GET',
headers: {
Authorization: `Bearer ${accessToken}`
}
});

const mpData = await mpResponse.json();

if (!mpResponse.ok) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao consultar pagamento no Mercado Pago',
details: mpData
})
};
}

if (mpData.status === 'approved') {
await fetch(`${siteUrl}/.netlify/functions/generate-report`, {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
paymentId: String(paymentId)
})
});
}

return {
statusCode: 200,
body: JSON.stringify({
received: true,
paymentId,
status: mpData.status
})
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro no webhook',
details: error.message
})
};
}
}