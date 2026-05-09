import { createBackendUrl } from '@/lib/backend-fetch';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backendUrl = `${createBackendUrl(`/api/sessions/${id}/chat/subscribe`)}`;

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
  } catch (error) {
    console.error('[API] SSE subscribe error:', error);
    return new Response(
      JSON.stringify({ type: 'error', message: 'SSE 连接失败' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}