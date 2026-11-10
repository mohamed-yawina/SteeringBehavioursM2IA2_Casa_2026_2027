import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
export function createArenaServer() {
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        response.writeHead(403).end('Accès interdit'); return;
      }
      if (!(await stat(filename)).isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(await readFile(filename));
    } catch {
      response.writeHead(404).end('Fichier introuvable');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8088);
  const server = createArenaServer();
  server.on('error', error => { console.error(`Serveur indisponible : ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`EVOLUTION ARENA : http://127.0.0.1:${port} — Ctrl+C pour arrêter`));
}
