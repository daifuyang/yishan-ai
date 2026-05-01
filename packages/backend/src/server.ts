import 'dotenv/config';
import Fastify from 'fastify';
import app from './app.js';
import { cleanupOldLogs, LOG_DIR, LOG_RETENTION_DAYS } from './lib/logger.js';
import * as fs from 'fs';

const PORT = parseInt(process.env.PORT || '3000', 10);

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

cleanupOldLogs();

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

async function start() {
  await fastify.register(app);

  try {
    const address = await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening at ${address}`);
    console.log(`Log directory: ${LOG_DIR}`);
    if (LOG_RETENTION_DAYS > 0) {
      console.log(`Log retention: ${LOG_RETENTION_DAYS} days`);
    } else {
      console.log('Log retention: forever');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();