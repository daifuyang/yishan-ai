import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { configManager } from '../lib/config-manager.js';

function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

const SECURITY_FIELDS = ['sandbox', 'models.apiKey'];

function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const redacted = JSON.parse(JSON.stringify(config));
  if (redacted.models && typeof redacted.models === 'object') {
    const models = redacted.models as Record<string, unknown>;
    if (models.apiKey) {
      models.apiKey = '***configured***';
    }
  }
  return redacted;
}

function containsSecurityField(updates: Record<string, unknown>): string | null {
  for (const field of SECURITY_FIELDS) {
    const keys = field.split('.');
    let current: unknown = updates;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) return field;
  }
  return null;
}

const configRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/config', async () => {
    return redactConfig(configManager.getAll() as unknown as Record<string, unknown>);
  });

  fastify.patch('/api/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = request.body as Record<string, unknown>;

      const blockedField = containsSecurityField(updates);
      if (blockedField) {
        return reply.code(403).send({
          error: `Cannot modify security field '${blockedField}' via PATCH. Use the dedicated API or edit config.json directly.`,
        });
      }

      const workspace = updates.workspace as { directories?: string[] } | undefined;
      if (workspace?.directories) {
        workspace.directories = (workspace.directories || []).map((d: string) => expandPath(d));
      }
      configManager.set(updates);
      return {
        success: true,
        config: redactConfig(configManager.getAll() as unknown as Record<string, unknown>),
      };
    } catch (error: unknown) {
      const err = error as Error;
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.put('/api/config/api-key', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { apiKey?: string };
      if (!body.apiKey || typeof body.apiKey !== 'string') {
        return reply.code(400).send({ error: 'apiKey is required' });
      }
      configManager.patch('models.apiKey', body.apiKey);
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.get<{ Querystring: { path?: string } }>(
    '/api/config/workspace/validate',
    async (request: FastifyRequest<{ Querystring: { path?: string } }>, reply: FastifyReply) => {
      const { path: validatePath } = request.query;

      if (!validatePath) {
        return reply.code(400).send({ error: 'path is required' });
      }

      try {
        const expanded = expandPath(validatePath);
        const normalized = path.resolve(expanded);
        const stats = await fs.promises.stat(normalized);
        const readable = await fs.promises
          .access(normalized, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false);
        const writable = await fs.promises
          .access(normalized, fs.constants.W_OK)
          .then(() => true)
          .catch(() => false);

        const config = configManager.getAll();
        const allowedDirs = config.workspace?.directories ?? [];

        const isInWorkspaceList = allowedDirs.some((dir) => normalized === path.resolve(dir));

        const protectedPaths = ['/etc', '/root', '/.ssh', '/proc', '/sys'];
        const isProtected = protectedPaths.some((p) => normalized.startsWith(p));

        const valid = readable && writable && !isProtected && stats.isDirectory();

        return {
          valid,
          readable,
          writable,
          exists: stats.isDirectory(),
          isInWorkspaceList,
          isProtected,
          error: !valid
            ? isProtected
              ? 'System protected path'
              : !stats.isDirectory()
                ? 'Not a directory'
                : !readable
                  ? 'Not readable'
                  : !writable
                    ? 'Not writable'
                    : 'Unknown'
            : undefined,
        };
      } catch (error: unknown) {
        const err = error as { code?: string; message: string };
        return {
          valid: false,
          readable: false,
          writable: false,
          exists: false,
          isInWorkspaceList: false,
          isProtected: false,
          error: err.code === 'ENOENT' ? 'Directory does not exist' : err.message,
        };
      }
    }
  );
};

export default configRoutes;
