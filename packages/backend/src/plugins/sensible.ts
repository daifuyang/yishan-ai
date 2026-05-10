import fastifySensible from '@fastify/sensible';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(fastifySensible);
  },
  { name: 'sensible' }
);
