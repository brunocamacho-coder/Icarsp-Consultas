export async function handler() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: process.env.EFI_ACCOUNT_ID || '',
    }),
  };
}
