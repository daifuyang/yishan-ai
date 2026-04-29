const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4800';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${BACKEND_URL}/api/sessions/${id}`);
  const data = await res.json();
  return Response.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const res = await fetch(`${BACKEND_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${BACKEND_URL}/api/sessions/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return Response.json(data);
}