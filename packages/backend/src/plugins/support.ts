import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../frontend/out');

export default fp(async (fastify: any) => {
  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(fastifyCors, {
      origin: ['http://localhost:4810', 'http://localhost:4820'],
      credentials: true,
    });
  }

  await fastify.register(fastifyStatic, {
    root: FRONTEND_DIR,
    prefix: '/',
    decorateReply: true,
    wildcard: false,
  });

  fastify.setNotFoundHandler((request: any, reply: any) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found' });
    }
    return reply.sendFile('index.html');
  });
}, { name: 'support' });