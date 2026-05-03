const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:4800',
  changeOrigin: true,
});

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (res && !res.writableEnded) {
    res.statusCode = 502;
    res.end('Proxy error');
  }
});

proxy.on('econnreset', (err, req, res) => {
  console.error('Connection reset:', err);
});

app.prepare().then(() => {
  createServer((req, res) => {
    const { pathname } = parse(req.url, true);
    const accept = req.headers.accept || '';
    const isSSE = accept.includes('text/event-stream');

    if (pathname.startsWith('/api/') || isSSE) {
      proxy.web(req, res);
    } else {
      handle(req, res);
    }
  }).on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    if (pathname.startsWith('/api/')) {
      proxy.ws(req, socket, head);
    }
  }).listen(4810, (err) => {
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    console.log('> Dev server on http://localhost:4810');
  });
});