import fp from 'fastify-plugin';
import fastifySensible from '@fastify/sensible';

export default fp(async (fastify: any) => {
  await fastify.register(fastifySensible);
}, { name: 'sensible' });