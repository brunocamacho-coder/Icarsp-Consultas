export async function handler() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey: process.env.MP_PUBLIC_KEY || '' })
  };
}
