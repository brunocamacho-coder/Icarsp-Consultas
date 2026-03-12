import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
try {
if (event.httpMethod !== 'GET') {
return {
statusCode: 405,
body: JSON.stringify({ error: 'Método não permitido' })
};
}

const paymentId = event.queryStringParameters?.paymentId;

if (!paymentId) {
return {
statusCode: 400,
body: JSON.stringify({ error: 'paymentId obrigatório' })
};
}

const { data, error } = await supabase
.from('vehicle_reports')
.select('status, report, placa, updated_at')
.eq('payment_id', String(paymentId))
.single();

if (error || !data) {
return {
statusCode: 404,
body: JSON.stringify({ error: 'Relatório não encontrado' })
};
}

return {
statusCode: 200,
body: JSON.stringify({
status: data.status,
placa: data.placa,
report: data.report || null,
updatedAt: data.updated_at
})
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao buscar relatório salvo',
details: error.message
})
};
}
}