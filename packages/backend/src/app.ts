import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import { getDb, closeDb } from './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts,
  });

  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts,
  });

  getDb();

  const streamingSessions = getDb().prepare(
    "SELECT id FROM sessions WHERE status = 'streaming'"
  ).all() as { id: string }[];

  if (streamingSessions.length > 0) {
    fastify.log.warn(`Found ${streamingSessions.length} streaming sessions on startup, marking as failed`);
    const updateStmt = getDb().prepare("UPDATE sessions SET status = 'failed' WHERE status = 'streaming'");
    updateStmt.run();
  }

  fastify.addHook('onClose', async () => {
    closeDb();
  });
};

export default app;