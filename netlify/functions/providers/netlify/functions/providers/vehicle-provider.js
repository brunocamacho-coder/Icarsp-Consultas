async function getVehicleReportByPlate(placa) {
// Mock inicial
// Depois você substitui isso pela API real

return {
success: true,
placa,
vehicle: {
marca_modelo: "Toyota Corolla XEi",
ano: "2020/2021",
cor: "Prata",
combustivel: "Flex",
fipe: "R$ 98.450,00",
chassi: "9BWZZZ377VT004251",
renavam: "12345678901"
},
status: {
roubo_furto: "Sem registro",
leilao: "Não consta",
debitos: "Constam pendências",
restricoes: "Constam restrições",
gravame: "Ativo",
licenciamento_ipva: "Pendente de regularização"
},
details: {
instituicao_credora: "Banco credor vinculado",
detalhes_bloqueio: "Restrição administrativa identificada"
},
summary: "O veículo apresenta pendências que exigem atenção antes da negociação, transferência ou regularização."
};
}

module.exports = {
getVehicleReportByPlate
};