import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { configManager } from '../lib/config-manager.js';

const execFileAsync = promisify(execFile);

const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/workspace/pick-directory', async (_request, reply: FastifyReply) => {
    try {
      const { stdout } = await execFileAsync('osascript', [
        '-e',
        'set selectedFolder to choose folder with prompt "选择工作目录"',
        '-e',
        'POSIX path of selectedFolder',
      ]);
      const selected = stdout.trim().replace(/\/$/, '');
      if (!selected) {
        return reply.code(204).send();
      }
      return { path: selected };
    } catch {
      return reply.code(204).send();
    }
  });

  fastify.get<{ Querystring: { path?: string } }>(
    '/api/workspace/browse',
    async (request: FastifyRequest<{ Querystring: { path?: string } }>, reply: FastifyReply) => {
      const directories = configManager.get<string[]>('workspace.directories') || [];

      if (directories.length === 0) {
        return reply.code(400).send({ error: 'No workspace directories configured' });
      }

      const requestedPath = request.query.path || '';

      if (!requestedPath) {
        return {
          path: '',
          directories: directories.map((d) => ({
            name: path.basename(d),
            path: d,
          })),
        };
      }

      const resolved = path.resolve(requestedPath);

      const isWithinWhitelist = directories.some(
        (dir) => resolved === dir || resolved.startsWith(dir + path.sep)
      );

      if (!isWithinWhitelist) {
        return reply.code(403).send({ error: 'Path is outside allowed workspace directories' });
      }

      if (resolved.includes('..')) {
        return reply.code(403).send({ error: 'Path traversal not allowed' });
      }

      try {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
          return reply.code(400).send({ error: 'Path is not a directory' });
        }
      } catch {
        return reply.code(404).send({ error: 'Path does not exist' });
      }

      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const subdirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({
          name: e.name,
          path: path.join(resolved, e.name),
        }));

      return {
        path: resolved,
        directories: subdirs,
      };
    }
  );
};

export default workspaceRoutes;
