import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

function basicAuthHeader() {
const email = process.env.CONSULTARPLACA_EMAIL;
const apiKey = process.env.CONSULTARPLACA_API_KEY;
return 'Basic ' + Buffer.from(`${email}:${apiKey}`).toString('base64');
}

async function consultarEndpoint(endpoint, placa, authHeader) {
const response = await fetch(
`https://api.consultarplaca.com.br/v2/${endpoint}?placa=${encodeURIComponent(placa)}`,
{
method: 'GET',
headers: {
Authorization: authHeader,
'Content-Type': 'application/json'
}
}
);

const text = await response.text();
let data;

try {
data = JSON.parse(text);
} catch {
data = { raw: text };
}

if (!response.ok) {
throw new Error(`${endpoint} falhou com status ${response.status}`);
}

return data;
}

export async function handler(event) {
try {
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
body: JSON.stringify({ error: 'Método não permitido' })
};
}

const { paymentId } = JSON.parse(event.body || '{}');

if (!paymentId) {
return {
statusCode: 400,
body: JSON.stringify({ error: 'paymentId obrigatório' })
};
}

const { data: record, error: fetchError } = await supabase
.from('vehicle_reports')
.select('*')
.eq('payment_id', String(paymentId))
.single();

if (fetchError || !record) {
return {
statusCode: 404,
body: JSON.stringify({ error: 'Pagamento não encontrado' })
};
}

if (record.status === 'ready' && record.report) {
return {
statusCode: 200,
body: JSON.stringify({
success: true,
cached: true,
report: record.report
})
};
}

const placa = record.placa;
const authHeader = basicAuthHeader();

const veiculo = await consultarEndpoint('consultarPlaca', placa, authHeader);

const resultados = await Promise.allSettled([
consultarEndpoint('consultarGravame', placa, authHeader),
consultarEndpoint('consultarProprietarioAtual', placa, authHeader),
consultarEndpoint('consultarPrecoFipe', placa, authHeader)
]);

const gravame = resultados[0].status === 'fulfilled' ? resultados[0].value : null;
const proprietarioAtual = resultados[1].status === 'fulfilled' ? resultados[1].value : null;
const precoFipe = resultados[2].status === 'fulfilled' ? resultados[2].value : null;

const report = {
placa,
veiculo,
gravame,
proprietarioAtual,
precoFipe,
generatedAt: new Date().toISOString(),
custoTotalEstimado: 12.80
};

const { error: updateError } = await supabase
.from('vehicle_reports')
.update({
status: 'ready',
report,
updated_at: new Date().toISOString()
})
.eq('payment_id', String(paymentId));

if (updateError) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao salvar relatório',
details: updateError.message
})
};
}

return {
statusCode: 200,
body: JSON.stringify({
success: true,
cached: false,
report
})
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao gerar relatório',
details: error.message
})
};
}
}