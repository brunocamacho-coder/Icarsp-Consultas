import fetch from 'node-fetch';

const API_KEY = process.env.CONSULTARPLACA_API_KEY;
const EMAIL = process.env.CONSULTARPLACA_EMAIL;

function normalizarPlaca(placa = '') {
  return String(placa).replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

function safe(value, fallback = '-') {
  return value ?? fallback;
}

function montarTeaser(report) {
  let alertCount = 0;
  const alertas = [];

  const status = report?.status || {};

  const campos = [
    ['roubo_furto', 'roubo/furto'],
    ['leilao', 'leilão'],
    ['debitos', 'débitos'],
    ['restricoes', 'restrições'],
    ['gravame', 'gravame'],
    ['licenciamento_ipva', 'licenciamento/IPVA']
  ];

  for (const [key, label] of campos) {
    const valor = String(status[key] || '').toLowerCase();

    const ok =
      valor.includes('sem registro') ||
      valor.includes('não consta') ||
      valor.includes('nao consta') ||
      valor.includes('regular') ||
      valor.includes('inexistente');

    if (!ok && valor && valor !== '-') {
      alertCount += 1;
      alertas.push(label);
    }
  }

  const message =
    alertCount > 0
      ? `Encontramos ${alertCount} verificação(ões) que merecem atenção nesta placa.`
      : 'Encontramos informações relevantes e verificações adicionais para esta placa.';

  return {
    alertCount,
    message,
    itens: alertas
  };
}

/**
 * ADAPTE ESTA FUNÇÃO se a API real tiver outro endpoint ou outro formato.
 */
async function consultarApiExterna(placa) {
  if (!API_KEY || !EMAIL) {
    throw new Error('CONSULTARPLACA_API_KEY ou CONSULTARPLACA_EMAIL não configurados.');
  }

  // Exemplo genérico baseado no seu provedor atual.
  // Se a documentação da sua API for diferente, ajuste aqui.
  const url = `https://wdapi2.com.br/consulta/${placa}?token=${API_KEY}&email=${encodeURIComponent(EMAIL)}&timeout=300`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida da API de consulta: ${text?.slice(0, 300) || 'vazia'}`);
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.erro || `Falha na API externa (${response.status})`);
  }

  return data;
}

function mapearDados(placa, apiData) {
  // Ajuste estes caminhos se a resposta real da sua API vier com nomes diferentes.
  const vehicle = apiData?.vehicle || apiData?.veiculo || apiData?.dados || apiData?.data || apiData;

  const report = {
    placa,
    basic: {
      marca_modelo: safe(vehicle?.marca_modelo || vehicle?.marcaModelo || vehicle?.modelo),
      ano: safe(vehicle?.ano || vehicle?.ano_modelo || vehicle?.anoModelo),
      combustivel: safe(vehicle?.combustivel),
      cidade_registro: safe(vehicle?.cidade_registro || vehicle?.municipio || vehicle?.cidade),
      uf_registro: safe(vehicle?.uf_registro || vehicle?.uf),
      cor: safe(vehicle?.cor)
    },
    vehicle: {
      marca_modelo: safe(vehicle?.marca_modelo || vehicle?.marcaModelo || vehicle?.modelo),
      ano: safe(vehicle?.ano || vehicle?.ano_modelo || vehicle?.anoModelo),
      cor: safe(vehicle?.cor),
      combustivel: safe(vehicle?.combustivel),
      fipe: safe(vehicle?.fipe || vehicle?.valor_fipe || vehicle?.valorFipe),
      chassi: safe(vehicle?.chassi),
      renavam: safe(vehicle?.renavam)
    },
    status: {
      roubo_furto: safe(vehicle?.roubo_furto || vehicle?.rouboFurto || apiData?.roubo_furto),
      leilao: safe(vehicle?.leilao || apiData?.leilao),
      debitos: safe(vehicle?.debitos || apiData?.debitos),
      restricoes: safe(vehicle?.restricoes || vehicle?.restricao || apiData?.restricoes),
      gravame: safe(vehicle?.gravame || apiData?.gravame),
      licenciamento_ipva: safe(
        vehicle?.licenciamento_ipva ||
          vehicle?.licenciamentoIPVA ||
          vehicle?.ipva_licenciamento ||
          apiData?.licenciamento_ipva
      )
    },
    details: {
      instituicao_credora: safe(
        vehicle?.instituicao_credora || vehicle?.instituicaoCredora || apiData?.instituicao_credora
      ),
      detalhes_bloqueio: safe(
        vehicle?.detalhes_bloqueio || vehicle?.detalhesBloqueio || apiData?.detalhes_bloqueio
      )
    },
    offer: {
      price: 'R$ 14,99'
    }
  };

  report.teaser = montarTeaser(report);

  return report;
}

export async function getVehicleBasicReportByPlate(placaInformada) {
  const placa = normalizarPlaca(placaInformada);

  if (!placa || placa.length < 7) {
    throw new Error('Placa inválida.');
  }

  const apiData = await consultarApiExterna(placa);
  const report = mapearDados(placa, apiData);

  return {
    success: true,
    ...report
  };
}

export async function getVehicleReportByPlate(placaInformada) {
  const placa = normalizarPlaca(placaInformada);

  if (!placa || placa.length < 7) {
    throw new Error('Placa inválida.');
  }

  const apiData = await consultarApiExterna(placa);
  const report = mapearDados(placa, apiData);

  return report;
}