const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendUrl = `${BACKEND_URL}/api/sessions/${id}/chat/subscribe`;

  const cookieHeader = request.headers.get('cookie');

  const response = await fetch(backendUrl, {
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...(cookieHeader && { 'Cookie': cookieHeader }),
    },
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const stream = response.body?.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    })
  );

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}