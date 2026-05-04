import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'node:os';

function getConfiguredDirs(): string[] {
  const configPath = path.join(os.homedir(), '.yishan-ai', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.workspace?.directories) {
        return config.workspace.directories;
      }
    }
  } catch (e) {}
  return [];
}

function resolveHostPath(requestedPath: string): string | null {
  const dirs = getConfiguredDirs();
  if (dirs.length === 0) return null;

  for (const dir of dirs) {
    const resolvedDir = path.resolve(dir);
    const requestedResolved = path.resolve(requestedPath);

    if (requestedResolved.startsWith(resolvedDir + path.sep) || requestedResolved === resolvedDir) {
      return requestedResolved;
    }

    const requestedBasename = path.basename(requestedPath);
    if (requestedPath === path.basename(dir) ||
        requestedPath.startsWith(path.basename(dir) + '/')) {
      const remainder = requestedPath.slice(path.basename(dir).length).replace(/^\//, '');
      const fullPath = remainder ? path.join(dir, remainder) : dir;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedPath = searchParams.get('path') || '';

  const targetPath = resolveHostPath(requestedPath);
  if (!targetPath) {
    return Response.json({ error: 'Invalid path' }, { status: 400 });
  }

  if (!fs.existsSync(targetPath)) {
    return Response.json({ error: 'Path not found' }, { status: 404 });
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return Response.json({ error: 'Not a directory' }, { status: 400 });
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

    return Response.json({
      items,
      parent: path.dirname(requestedPath).replace(/\\/g, '/'),
    });
  } catch (error) {
    return Response.json({ error: 'Failed to read directory' }, { status: 500 });
  }
}