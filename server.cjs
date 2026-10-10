const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
if (fs.existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/api/results') {
    try {
      if (!['GET','POST'].includes(req.method)) { res.writeHead(405, {'Allow':'GET, POST'}); return res.end('Method not allowed'); }
      let body = '';
      if (req.method === 'POST') for await (const chunk of req) { body += chunk; if (body.length > 2048) { res.writeHead(413); return res.end('Payload too large'); } }
      const api = await import('./api/results.mjs');
      const request = new Request(`http://${req.headers.host}${req.url}`, {method:req.method,headers:req.headers,...(req.method === 'POST' ? {body} : {})});
      const response = await api[req.method](request);
      res.writeHead(response.status, Object.fromEntries(response.headers)); return res.end(await response.text());
    } catch { res.writeHead(500, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'Сервис недоступен.'})); }
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.')) || !types[path.extname(file)]) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'}); res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Local: http://localhost:${port}`));
