import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { taskQueue } from '../lib/task-queue.js';

const CreateTaskSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
});

const tasksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/tasks', async (request: FastifyRequest, _reply: FastifyReply) => {
    const body = CreateTaskSchema.parse(request.body);
    const { type, payload } = body as { type: string; payload: unknown };
    const taskId = crypto.randomUUID();

    taskQueue.submit(taskId, async () => {
      return `Task ${type} completed with payload: ${JSON.stringify(payload)}`;
    });

    return { taskId };
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/tasks/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const task = taskQueue.get(id);

      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      return task;
    }
  );
};

export default tasksRoutes;
