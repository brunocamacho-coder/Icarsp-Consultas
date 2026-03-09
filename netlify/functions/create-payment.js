exports.handler = async (event) => {
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ error: 'Método não permitido' })
};
}

try {
const body = JSON.parse(event.body || '{}');
const placa = (body.placa || '').toUpperCase().trim();

if (!placa || placa.length < 7) {
return {
statusCode: 400,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ error: 'Placa inválida' })
};
}

// Exemplo fake para testar o fluxo
// Depois você substitui isso pela integração real de pagamento
return {
statusCode: 200,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
success: true,
qr_code: `PAGAMENTO-TESTE-PLACA-${placa}`,
placa
})
};
} catch (error) {
return {
statusCode: 500,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
error: 'Erro interno ao criar pagamento',
details: error.message
})
};
}
};