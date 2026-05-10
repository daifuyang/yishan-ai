const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const res = await fetch(`${BACKEND_URL}/api/skills/${name}`);
  const data = await res.json();
  return Response.json(data);
}

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await request.json();
  const res = await fetch(`${BACKEND_URL}/api/skills/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const res = await fetch(`${BACKEND_URL}/api/skills/${name}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return Response.json(data);
}
