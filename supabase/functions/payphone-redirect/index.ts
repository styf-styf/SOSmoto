// Payphone solo permite una "Url de respuesta" http(s) en el panel de developer.
// Esta función puente recibe esa redirección y la reenvía al deep link de la app,
// que es lo que `expo-web-browser` (openAuthSessionAsync) está esperando.
Deno.serve((req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? '';
  const clientTransactionId = url.searchParams.get('clientTransactionId') ?? '';

  const target = `sosmoto://payphone-return?id=${encodeURIComponent(id)}&clientTransactionId=${encodeURIComponent(clientTransactionId)}`;

  return new Response(null, { status: 302, headers: { Location: target } });
});
