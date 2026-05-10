const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/skills`);
    const data = await res.json();
    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }
    return Response.json(Array.isArray(data) ? data : []);
  } catch {
    return Response.json([]);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${BACKEND_URL}/api/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
