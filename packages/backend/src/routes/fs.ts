import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { isPathContained } from '../sandbox/path-check.js';

const TEXT_EXTENSIONS = [
  '.md',
  '.txt',
  '.json',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.html',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.sh',
  '.bash',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.sql',
  '.log',
];

function getConfiguredDirs(): string[] {
  const configPath = path.join(os.homedir(), '.yishan-ai', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.workspace?.directories) {
        return config.workspace.directories.map((d: string) =>
          d.startsWith('~') ? d.replace('~', os.homedir()) : d
        );
      }
    }
  } catch {}
  return [];
}

function resolveAndValidatePath(requestedPath: string): string | null {
  const dirs = getConfiguredDirs();
  if (dirs.length === 0) return null;

  const requestedResolved = path.resolve(requestedPath);

  for (const dir of dirs) {
    if (isPathContained(requestedResolved, dir)) {
      return requestedResolved;
    }
  }

  for (const dir of dirs) {
    if (
      requestedPath === path.basename(dir) ||
      requestedPath.startsWith(`${path.basename(dir)}/`)
    ) {
      const remainder = requestedPath.slice(path.basename(dir).length).replace(/^\//, '');
      const fullPath = remainder ? path.join(dir, remainder) : dir;
      if (fs.existsSync(fullPath) && isPathContained(fullPath, dir)) {
        return fullPath;
      }
    }
  }

  return null;
}

const fsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/fs/read', async (request) => {
    const urlObj = new URL(request.url, `http://${request.headers.host}`);
    const requestedPath = urlObj.searchParams.get('path') || '';

    const targetPath = resolveAndValidatePath(requestedPath);
    if (!targetPath) {
      return { error: 'Invalid path' };
    }

    if (!fs.existsSync(targetPath)) {
      return { error: 'File not found' };
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isFile()) {
      return { error: 'Not a file' };
    }

    const ext = path.extname(targetPath).toLowerCase();
    if (!TEXT_EXTENSIONS.includes(ext)) {
      return { error: 'File type not supported for preview' };
    }

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      return { content, ext };
    } catch {
      return { error: 'Failed to read file' };
    }
  });

  fastify.get('/api/fs/list', async (request) => {
    const urlObj = new URL(request.url, `http://${request.headers.host}`);
    const requestedPath = urlObj.searchParams.get('path') || '';

    const targetPath = resolveAndValidatePath(requestedPath);
    if (!targetPath) {
      return { error: 'Invalid path' };
    }

    if (!fs.existsSync(targetPath)) {
      return { error: 'Path not found' };
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return { error: 'Not a directory' };
    }

    try {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      const items = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: entry.isFile() ? fs.statSync(path.join(targetPath, entry.name)).size : 0,
        mtime: fs.statSync(path.join(targetPath, entry.name)).mtime.toISOString(),
      }));

      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return {
        items,
        parent: path.dirname(requestedPath).replace(/\\/g, '/'),
      };
    } catch {
      return { error: 'Failed to read directory' };
    }
  });
};

export default fsRoutes;
