import * as fs from 'node:fs';
import Fastify from 'fastify';
import app from './app.js';
import { configManager } from './lib/config-manager.js';
import { cleanupOldLogs, LOG_DIR, LOG_RETENTION_DAYS } from './lib/logger.js';
import { getAuthToken, getTokenPath } from './plugins/auth.js';
import { probeSandboxExec } from './sandbox/probe.js';

const PORT = configManager.get<number>('server.port') || 4800;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

cleanupOldLogs();
probeSandboxExec();

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

async function start() {
  await fastify.register(app);

  try {
    const address = await fastify.listen({ port: PORT, host: '127.0.0.1' });
    console.log(`Server listening at ${address}`);
    console.log(`Auth token: ${getAuthToken()}`);
    console.log(`Token file: ${getTokenPath()}`);
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
