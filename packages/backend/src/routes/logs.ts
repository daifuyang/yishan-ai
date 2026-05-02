import { FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_DIR = process.env.LOG_DIR || path.join(os.homedir(), '.yishan-ai', 'logs');

const logsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/logs', async () => {
    if (!fs.existsSync(LOG_DIR)) {
      return [];
    }

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(filename => {
        const filePath = path.join(LOG_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));

    return files;
  });

  fastify.get('/api/logs/:filename', async (request) => {
    const { filename } = request.params as { filename: string };

    if (!filename.includes('session-') || !filename.endsWith('.log')) {
      return { error: 'Invalid filename' };
    }

    const filePath = path.join(LOG_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return { error: 'File not found' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  });
};

export default logsRoutes;