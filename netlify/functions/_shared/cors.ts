const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function getCorsHeaders() {
  return { ...CORS_HEADERS, "Content-Type": "application/json" };
}

export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
