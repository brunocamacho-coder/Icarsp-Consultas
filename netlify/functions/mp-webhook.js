export async function handler(event) {
  try {
    let paymentId = null;

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      paymentId = body?.data?.id || body?.id || null;
    }

    if (!paymentId && event.queryStringParameters) {
      paymentId =
        event.queryStringParameters['data.id'] ||
        event.queryStringParameters.id ||
        null;
    }

    if (!paymentId) {
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, message: 'Sem paymentId para processar' })
      };
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const siteUrl = process.env.SITE_URL;

    if (!accessToken || !siteUrl) {
      console.error('Webhook: MP_ACCESS_TOKEN ou SITE_URL não configurados');
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, message: 'Configuração incompleta' })
      };
    }

    // Consulta o status real do pagamento no Mercado Pago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!mpResponse.ok) {
      console.error('Webhook: erro ao consultar pagamento', paymentId, mpResponse.status);
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, message: 'Erro ao consultar pagamento no MP' })
      };
    }

    const mpData = await mpResponse.json();
    const status = mpData.status || 'unknown';
    const tipo = mpData.metadata?.tipo || '';

    const isContrato = tipo === 'contrato' || tipo === 'contrato_reserva';

    // Se pagamento aprovado e não é contrato, dispara a geração do relatório
    if (status === 'approved' && !isContrato) {
      try {
        const genResponse = await fetch(`${siteUrl}/.netlify/functions/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: String(paymentId) })
        });

        if (!genResponse.ok) {
          console.error('Webhook: generate-report retornou erro', genResponse.status);
        }
      } catch (generateError) {
        console.error('Webhook: erro ao disparar generate-report:', generateError.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        received: true,
        paymentId: String(paymentId),
        status
      })
    };
  } catch (error) {
    console.error('Webhook: erro inesperado:', error.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, error: 'Erro interno no webhook' })
    };
  }
}
