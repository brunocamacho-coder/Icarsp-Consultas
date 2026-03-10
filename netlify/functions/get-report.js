const vehicleProvider = require('./providers/vehicle-provider');

exports.handler = async (event) => {
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
const placa = (event.queryStringParameters?.placa || '')
.replace(/[^a-zA-Z0-9]/g, '')
.toUpperCase()
.trim();

if (!placa || placa.length < 7) {
return {
statusCode: 400,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ error: 'Placa inválida' })
};
}

const report = await vehicleProvider.getVehicleReportByPlate(placa);

return {
statusCode: 200,
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify(report)
};
} catch (error) {
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