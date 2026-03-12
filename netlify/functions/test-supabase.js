import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
try {
const { data, error } = await supabase
.from('vehicle_reports')
.select('payment_id, placa, status')
.limit(1);

if (error) {
return {
statusCode: 500,
body: JSON.stringify({
success: false,
error: 'Erro ao consultar Supabase',
details: error
})
};
}

return {
statusCode: 200,
body: JSON.stringify({
success: true,
message: 'Conexão com Supabase OK',
data
})
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
success: false,
error: 'Falha de conexão com Supabase',
details: error.message || String(error)
})
};
}
}