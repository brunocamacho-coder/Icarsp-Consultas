import { getVehicleBasicReportByPlate } from './providers/vehicle-provider.js';
import { createClient } from '@supabase/supabase-js';

// SQL para criar a tabela no Supabase (execute uma vez no painel SQL Editor):
// CREATE TABLE preview_rate_limit (
//   id BIGSERIAL PRIMARY KEY,
//   ip TEXT NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX idx_preview_rate_limit_ip ON preview_rate_limit(ip);

const LIMITE_POR_IP = 1;       // 1 consulta gratuita por IP
const JANELA_HORAS = 24;       // dentro de 24 horas

export const handler = async (event) => {
  try {
    const placa = event.queryStringParameters?.placa;

    if (!placa) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Placa não informada.' })
      };
    }

    // Pegar IP do visitante
    const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['client-ip']
      || 'unknown';

    // Verificar rate limit
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const janela = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString();

      const { count } = await supabase
        .from('preview_rate_limit')
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', janela);

      if (count >= LIMITE_POR_IP) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            blocked: true,
            message: 'Você já utilizou sua consulta gratuita. Adquira o relatório completo para continuar.'
          })
        };
      }

      // Registrar esta consulta
      await supabase.from('preview_rate_limit').insert({ ip });

    } catch (rateError) {
      // Se a tabela não existir ainda, permite a consulta e loga o erro
      console.warn('Rate limit check falhou (tabela existe?):', rateError.message);
    }

    const data = await getVehicleBasicReportByPlate(placa);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Erro em get-basic-report:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Erro interno ao consultar placa.'
      })
    };
  }
};
