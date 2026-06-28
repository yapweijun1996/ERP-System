// Minimal zero-dependency placeholder server for the ERP System.
// Served publicly at https://gmb01.xyz/erp via the `cloudflare_tunnel` cloudflared tunnel.
//
// cloudflared routes `gmb01.xyz` path `^/erp` here WITHOUT stripping the path, so every
// request arrives with its original path (e.g. `/erp`, `/erp/health`). We therefore mount
// everything under `/erp`. This is a link-bring-up placeholder — the real UI replaces the
// HTML later (see web/README.md). No external assets so nothing leaks to the root route.
import { createServer } from 'node:http';

const PORT = Number(process.env.ERP_PORT ?? 8791);
const STARTED = new Date().toISOString();

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ERP System — gmb01</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:linear-gradient(135deg,#0f172a,#1e293b); color:#e2e8f0; padding:24px; }
  .card { max-width:560px; width:100%; background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:40px;
    box-shadow:0 20px 60px rgba(0,0,0,.4); }
  .badge { display:inline-block; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
    color:#34d399; border:1px solid rgba(52,211,153,.4); border-radius:999px; padding:4px 12px; }
  h1 { margin:18px 0 8px; font-size:28px; }
  p { margin:8px 0; color:#94a3b8; }
  code { background:rgba(255,255,255,.08); padding:2px 6px; border-radius:6px; font-size:13px; }
  ul { color:#94a3b8; padding-left:20px; }
  .foot { margin-top:24px; font-size:13px; color:#64748b; }
</style>
</head>
<body>
  <main class="card">
    <span class="badge">● Live</span>
    <h1>ERP System</h1>
    <p>Dual-mode multi-tenant ERP — public link is up via Cloudflare Tunnel.</p>
    <p>Path <code>/erp</code> on <code>gmb01.xyz</code> is now routed to this host.</p>
    <ul>
      <li>Data layer: PGlite (demo) / PostgreSQL (prod) — one schema, two drivers</li>
      <li>Cross-module transaction: order → stock → invoice → balanced GL</li>
      <li>UI: placeholder — real frontend lands in <code>web/</code> next</li>
    </ul>
    <p class="foot">Health: <code>/erp/health</code> · Served by deploy/erp-server.mjs</p>
  </main>
</body>
</html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/erp/health' || path === '/health' || path === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'erp', startedAt: STARTED, now: new Date().toISOString() }));
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[erp] placeholder server listening on http://127.0.0.1:${PORT} (started ${STARTED})`);
});
