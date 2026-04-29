import 'dotenv/config';
import Fastify from 'fastify';
import app from './app.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

async function start() {
  await fastify.register(app);

  try {
    const address = await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();