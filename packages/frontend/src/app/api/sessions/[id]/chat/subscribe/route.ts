import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createBackendUrl } from '@/lib/backend-fetch';

const TOKEN_PATH = path.join(os.homedir(), '.yishan-ai', 'auth-token');

function getAuthToken(): string {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
  } catch {
    return '';
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const backendUrl = `${createBackendUrl(`/api/sessions/${id}/chat/subscribe`)}`;

    const cookieHeader = request.headers.get('cookie');
    const token = getAuthToken();

    const response = await fetch(backendUrl, {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(cookieHeader && { Cookie: cookieHeader }),
        ...(token && { 'x-auth-token': token }),
        host: '127.0.0.1:4800',
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
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API] SSE subscribe error:', error);
    return new Response(JSON.stringify({ type: 'error', message: 'SSE 连接失败' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
