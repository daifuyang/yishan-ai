const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:4800").replace(/\/+$/, "");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildUpstreamUrl(request: Request, path: string[]) {
  const url = new URL(request.url);
  const pathname = path.join("/");
  return `${BACKEND_URL}/api/${pathname}${url.search}`;
}

function buildRequestHeaders(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  return headers;
}

function buildResponseHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("content-length");
  return nextHeaders;
}

async function proxy(request: Request, path: string[]) {
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const upstreamResponse = await fetch(buildUpstreamUrl(request, path), {
    method,
    headers: buildRequestHeaders(request),
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: buildResponseHeaders(upstreamResponse.headers),
  });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}
