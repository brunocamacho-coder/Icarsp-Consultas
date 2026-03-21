export async function handler(event) {
try {
if (event.httpMethod !== 'GET') {
return {
statusCode: 405,
body: JSON.stringify({
error: 'Método não permitido'
})
};
}

const paymentId = event.queryStringParameters?.payment_id;
const tipo = event.queryStringParameters?.tipo || '';

if (!paymentId) {
return {
statusCode: 400,
body: JSON.stringify({
error: 'payment_id obrigatório'
})
};
}

const accessToken = process.env.MP_ACCESS_TOKEN;
const siteUrl = process.env.SITE_URL;

if (!accessToken) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'MP_ACCESS_TOKEN não configurado'
})
};
}

if (!siteUrl) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'SITE_URL não configurado'
})
};
}

const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
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

const status = mpData.status || 'unknown';
const pago = status === 'approved';

const isContrato = tipo === 'contrato' || tipo === 'contrato_reserva';

if (pago && !isContrato) {
try {
await fetch(`${siteUrl}/.netlify/functions/generate-report`, {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
paymentId: String(paymentId)
})
});
} catch (generateError) {
console.error('Erro ao disparar generate-report:', generateError);
}
}

return {
statusCode: 200,
body: JSON.stringify({
success: true,
payment_id: String(paymentId),
status,
pago
})
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro interno ao verificar pagamento',
details: error.message
})
};
}
}