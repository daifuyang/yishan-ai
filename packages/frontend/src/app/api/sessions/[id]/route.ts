import { backendFetch } from '@/lib/backend-fetch';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await backendFetch(`/api/sessions/${id}`);
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '获取会话详情失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const res = await backendFetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '更新会话失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await backendFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '删除会话失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
