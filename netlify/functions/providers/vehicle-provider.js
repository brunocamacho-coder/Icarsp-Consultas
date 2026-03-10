async function getVehicleReportByPlate(placa) {
const email = process.env.CONSULTARPLACA_EMAIL;
const apiKey = process.env.CONSULTARPLACA_API_KEY;

if (!email || !apiKey) {
throw new Error('Credenciais da Consultar Placa API não configuradas');
}

const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');

const response = await fetch(`https://api.consultarplaca.com.br/v2/consultarPlaca?placa=${encodeURIComponent(placa)}`, {
method: 'GET',
headers: {
'Authorization': `Basic ${auth}`,
'Accept': 'application/json'
}
});

const data = await response.json();

if (!response.ok) {
throw new Error(data?.mensagem || 'Erro ao consultar API Consultar Placa');
}

const dadosVeiculo = data?.dados?.informacoes_veiculo?.dados_veiculo || {};

return {
success: true,
placa: dadosVeiculo.placa || placa,
vehicle: {
marca_modelo: [dadosVeiculo.marca, dadosVeiculo.modelo].filter(Boolean).join(' '),
ano: [dadosVeiculo.ano_fabricacao, dadosVeiculo.ano_modelo].filter(Boolean).join('/'),
cor: dadosVeiculo.cor || '-',
combustivel: dadosVeiculo.combustivel || '-',
fipe: 'Em integração',
chassi: dadosVeiculo.chassi || '-',
renavam: 'Em integração'
},
status: {
roubo_furto: 'Em integração',
leilao: 'Em integração',
debitos: 'Em integração',
restricoes: 'Em integração',
gravame: 'Em integração',
licenciamento_ipva: 'Em integração'
},
details: {
instituicao_credora: 'Em integração',
detalhes_bloqueio: 'Em integração'
},
summary: 'Consulta básica carregada com sucesso. Demais módulos do relatório estão em fase de integração.'
};
}

module.exports = {
getVehicleReportByPlate
};