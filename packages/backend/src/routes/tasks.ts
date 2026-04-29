import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { taskQueue } from '../lib/task-queue.js';

const CreateTaskSchema = z.object({
  type: z.string(),
  payload: z.any(),
});

const tasksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/tasks', async (request: any, reply: any) => {
    const body = CreateTaskSchema.parse(request.body);
    const { type, payload } = body;
    const taskId = crypto.randomUUID();

    taskQueue.submit(taskId, async () => {
      return `Task ${type} completed with payload: ${JSON.stringify(payload)}`;
    });

    return { taskId };
  });

  fastify.get('/api/tasks/:id', async (request: any, reply: any) => {
    const { id } = request.params;
    const task = taskQueue.get(id);

    if (!task) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    return task;
  });
};

export default tasksRoutes;