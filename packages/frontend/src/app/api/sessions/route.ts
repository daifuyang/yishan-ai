import { backendFetch } from '@/lib/backend-fetch';

export async function GET() {
  try {
    const res = await backendFetch('/api/sessions');
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '获取会话列表失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await backendFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '创建会话失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
