import { getVehicleReportByPlate } from './providers/vehicle-provider.js';

function normalizarPlaca(valor = '') {
return String(valor).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
}

export const handler = async (event) => {
if (event.httpMethod !== 'GET') {
return {
statusCode: 405,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ error: 'Método não permitido' })
};
}

try {
const placa = normalizarPlaca(event.queryStringParameters?.placa || '');

if (!placa || placa.length < 7) {
return {
statusCode: 400,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ error: 'Placa inválida' })
};
}

const report = await getVehicleReportByPlate(placa);

return {
statusCode: 200,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify(report)
};
} catch (error) {
console.error('Erro em get-report:', error);

return {
statusCode: 500,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
error: 'Erro ao gerar relatório',
details: error.message
})
};
}
};