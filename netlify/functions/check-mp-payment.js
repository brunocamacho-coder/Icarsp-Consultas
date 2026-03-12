exports.handler = async (event) => {
try {
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const paymentId = event.queryStringParameters?.payment_id;
const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
return {
statusCode: 500,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
error: 'MP_ACCESS_TOKEN não configurado'
})
};
}

if (!paymentId) {
return {
statusCode: 400,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
error: 'payment_id não informado'
})
};
}

const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
method: 'GET',
headers: {
Authorization: `Bearer ${accessToken}`,
Accept: 'application/json'
}
});

const text = await mpResponse.text();

let data;
try {
data = JSON.parse(text);
} catch (e) {
return {
statusCode: 500,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
error: 'Resposta inválida do Mercado Pago',
raw: text
})
};
}

if (!mpResponse.ok) {
return {
statusCode: mpResponse.status,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
error: 'Erro ao consultar pagamento',
details: data
})
};
}

return {
statusCode: 200,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
pago: data.status === 'approved',
status: data.status || '',
status_detail: data.status_detail || '',
id: data.id || null
})
};
} catch (error) {
console.error('Erro em check-mp-payment:', error);

return {
statusCode: 500,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
error: error.message || 'Erro interno ao verificar pagamento'
})
};
}
};