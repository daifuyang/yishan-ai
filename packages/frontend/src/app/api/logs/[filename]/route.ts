const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const res = await fetch(`${BACKEND_URL}/api/logs/${filename}`);
  const data = await res.text();
  return new Response(data, {
    headers: { 'Content-Type': 'text/plain' },
  });
}