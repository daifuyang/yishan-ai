import { backendFetch } from '@/lib/backend-fetch';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await backendFetch(`/api/sessions/${id}/chat/stop`, { method: 'POST' });
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: '停止流失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
