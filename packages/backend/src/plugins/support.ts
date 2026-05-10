import * as fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(__dirname, '..', '..', 'public');

export default fp(
  async (fastify: FastifyInstance) => {
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

    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not Found' });
      }

      let url = request.url.split('?')[0];
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }

      const htmlFile = `${url.slice(1)}.html`;
      const fullPath = resolve(FRONTEND_DIR, htmlFile);

      if (htmlFile === '.html' || !fs.existsSync(fullPath)) {
        return reply.sendFile('index.html');
      }

      return reply.sendFile(htmlFile);
    });
  },
  { name: 'support' }
);
