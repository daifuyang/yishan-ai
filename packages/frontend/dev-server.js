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

app.prepare().then(() => {
  createServer((req, res) => {
    const { pathname } = parse(req.url, true);

    if (pathname.startsWith('/api/')) {
      proxy.web(req, res);
    } else {
      handle(req, res);
    }
  }).listen(4810, (err) => {
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    console.log('> Dev server on http://localhost:4810');
  });
});