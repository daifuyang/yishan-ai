import { backendFetch } from '@/lib/backend-fetch';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const res = await backendFetch(`/api/sessions/${id}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '发送消息失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}