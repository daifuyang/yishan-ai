const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';

export async function GET() {
  const res = await fetch(`${BACKEND_URL}/api/mcp/tools`);
  const data = await res.json();
  return Response.json(data);
}
