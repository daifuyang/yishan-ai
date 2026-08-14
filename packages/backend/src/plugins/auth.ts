import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

const TOKEN_DIR = path.join(os.homedir(), '.yishan-ai');
const TOKEN_PATH = path.join(TOKEN_DIR, 'auth-token');

let authToken: string;

function generateAndStoreToken(): string {
  const token = crypto.randomBytes(32).toString('hex');

  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
  return token;
}

export function getAuthToken(): string {
  return authToken;
}

export function getTokenPath(): string {
  return TOKEN_PATH;
}

async function authPlugin(fastify: FastifyInstance) {
  authToken = generateAndStoreToken();
  console.log(`[Auth] Token written to ${TOKEN_PATH}`);

  fastify.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0];

    if (url === '/api/health') return;
    if (!url.startsWith('/api/')) return;

    const host = request.headers.host || '';
    const hostname = host.split(':')[0];
    const allowedHosts = ['localhost', '127.0.0.1', '::1'];
    if (!allowedHosts.includes(hostname)) {
      reply.code(403).send({ error: 'Forbidden: invalid host' });
      return;
    }

    const tokenFromHeader = request.headers['x-auth-token'] as string | undefined;
    const urlObj = new URL(request.url, `http://${host}`);
    const tokenFromQuery = urlObj.searchParams.get('token');
    const providedToken = tokenFromHeader || tokenFromQuery;

    if (providedToken !== authToken) {
      reply.code(401).send({ error: 'Unauthorized: invalid or missing auth token' });
      return;
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
