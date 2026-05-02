import { FastifyPluginAsync } from 'fastify';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { configManager } from '../lib/config-manager.js';

function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

const configRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/config', async () => {
    return configManager.getAll();
  });

  fastify.patch('/api/config', async (request: any, reply: any) => {
    try {
      const updates = request.body;
      if (updates.workspace?.directories) {
        updates.workspace.directories = updates.workspace.directories.map((d: string) => expandPath(d));
      }
      configManager.set(updates);
      return { success: true, config: configManager.getAll() };
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  fastify.get('/api/config/workspace/validate', async (request: any, reply: any) => {
    const { path: validatePath } = request.query as { path: string };

    if (!validatePath) {
      return reply.code(400).send({ error: 'path is required' });
    }

    try {
      const expanded = expandPath(validatePath);
      const normalized = path.resolve(expanded);
      const stats = await fs.stat(normalized);
      const readable = await fs.access(normalized, fs.constants.R_OK).then(() => true).catch(() => false);
      const writable = await fs.access(normalized, fs.constants.W_OK).then(() => true).catch(() => false);

      const config = configManager.getAll();
      const allowedDirs = config.workspace?.directories ?? [];

      const isInWorkspaceList = allowedDirs.some(dir => normalized === path.resolve(dir));

      const protectedPaths = ['/etc', '/root', '/.ssh', '/proc', '/sys'];
      const isProtected = protectedPaths.some(p => normalized.startsWith(p));

      const valid = readable && writable && !isProtected && stats.isDirectory();

      return {
        valid,
        readable,
        writable,
        exists: stats.isDirectory(),
        isInWorkspaceList,
        isProtected,
        error: !valid ? (
          isProtected ? 'System protected path' :
          !stats.isDirectory() ? 'Not a directory' :
          !readable ? 'Not readable' :
          !writable ? 'Not writable' : 'Unknown'
        ) : undefined,
      };
    } catch (error: any) {
      return {
        valid: false,
        readable: false,
        writable: false,
        exists: false,
        isInWorkspaceList: false,
        isProtected: false,
        error: error.code === 'ENOENT' ? 'Directory does not exist' : error.message,
      };
    }
  });
};

export default configRoutes;