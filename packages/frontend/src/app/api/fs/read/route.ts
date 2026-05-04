import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'node:os';

const TEXT_EXTENSIONS = ['.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.xml', '.yaml', '.yml', '.toml', '.sh', '.bash', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.sql', '.log'];

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
    return Response.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isFile()) {
    return Response.json({ error: 'Not a file' }, { status: 400 });
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!TEXT_EXTENSIONS.includes(ext)) {
    return Response.json({ error: 'File type not supported for preview' }, { status: 400 });
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    return Response.json({ content, ext });
  } catch (error) {
    return Response.json({ error: 'Failed to read file' }, { status: 500 });
  }
}