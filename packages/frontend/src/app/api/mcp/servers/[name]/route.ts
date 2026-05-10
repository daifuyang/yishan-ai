const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const name = url.pathname.split('/').pop();
  const res = await fetch(`${BACKEND_URL}/api/mcp/servers/${name}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return Response.json(data);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const name = pathParts[pathParts.length - 2];
  const action = pathParts[pathParts.length - 1];

  const endpoint =
    action === 'connect' || action === 'disconnect'
      ? `${BACKEND_URL}/api/mcp/servers/${name}/${action}`
      : `${BACKEND_URL}/api/mcp/servers/${name}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await request.json()),
  });
  const data = await res.json();
  return Response.json(data);
}
