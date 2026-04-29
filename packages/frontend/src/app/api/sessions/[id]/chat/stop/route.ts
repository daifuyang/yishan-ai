const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4800';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${BACKEND_URL}/api/sessions/${id}/chat/stop`, {
    method: 'POST',
  });
  const data = await res.json();
  return Response.json(data);
}