import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:4800').replace(/\/+$/, '');
const TIMEOUT_MS = 10000;
const TOKEN_PATH = nodePath.join(os.homedir(), '.yishan-ai', 'auth-token');

function getAuthToken(): string {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
  } catch {
    return '';
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildUpstreamUrl(request: Request, routePath: string[]) {
  const url = new URL(request.url);
  const pathname = routePath.join('/');
  return `${BACKEND_URL}/api/${pathname}${url.search}`;
}

function buildRequestHeaders(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  const token = getAuthToken();
  if (token) {
    headers.set('x-auth-token', token);
  }
  headers.set('host', '127.0.0.1:4800');
  return headers;
}

function buildResponseHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete('content-length');
  return nextHeaders;
}

async function proxy(request: Request, path: string[]) {
  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(buildUpstreamUrl(request, path), {
      method,
      headers: buildRequestHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: buildResponseHeaders(upstreamResponse.headers),
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: '请求超时' }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    return await proxy(request, path);
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    return await proxy(request, path);
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    return await proxy(request, path);
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    return await proxy(request, path);
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    return await proxy(request, path);
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    return await proxy(request, path);
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
