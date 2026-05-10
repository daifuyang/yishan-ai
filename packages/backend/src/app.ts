import 'dotenv/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AutoLoad, { type AutoloadPluginOptions } from '@fastify/autoload';
import type { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import { prisma } from './lib/stream-processor.js';

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

  const streamingSessions = await prisma.session.findMany({
    where: { status: 'streaming' },
    select: { id: true },
  });

  if (streamingSessions.length > 0) {
    fastify.log.warn(
      `Found ${streamingSessions.length} streaming sessions on startup, marking as failed`
    );
    await prisma.session.updateMany({
      where: { status: 'streaming' },
      data: { status: 'failed' },
    });
  }

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default app;
