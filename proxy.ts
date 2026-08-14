import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const PROXY_PORT = Number(process.env.PORT || 3000);
const BACKEND_PORT = Number(process.env.INTERNAL_API_PORT || 3001);
const BACKEND_HOST = '127.0.0.1';
const backendEntry = path.join(__dirname, 'server.cjs');

const backendEnv = {
  ...process.env,
  PORT: String(BACKEND_PORT),
};

const backend: ChildProcess = spawn(process.execPath, [backendEntry], {
  env: backendEnv,
  stdio: 'inherit',
});

backend.on('error', (error) => {
  console.error('Failed to start API backend:', error);
  process.exit(1);
});

backend.on('exit', (code, signal) => {
  if (code !== 0 && signal !== 'SIGTERM') {
    console.error(`API backend exited with code ${code ?? 'unknown'} (${signal ?? 'no signal'})`);
    process.exit(code ?? 1);
  }
});

function addCorsHeaders(headers: http.OutgoingHttpHeaders) {
  headers['access-control-allow-origin'] = process.env.FRONTEND_URL || '*';
  headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
  headers['access-control-max-age'] = '86400';
}

const proxy = http.createServer((req, res) => {
  addCorsHeaders(res.getHeaders());

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const proxyReq = http.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${BACKEND_HOST}:${BACKEND_PORT}`,
      },
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers };
      addCorsHeaders(headers);
      res.writeHead(proxyRes.statusCode || 502, headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (error) => {
    console.error('API proxy error:', error.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'API backend is unavailable.' }));
  });

  req.pipe(proxyReq);
});

proxy.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`CORS API proxy listening on port ${PROXY_PORT}; backend on ${BACKEND_PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down API proxy and backend.`);
  proxy.close(() => {
    backend.kill('SIGTERM');
    setTimeout(() => process.exit(0), 500);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
