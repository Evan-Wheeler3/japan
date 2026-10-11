// Co-op on your own machine: serves the game and runs the relay (the same rooms and messages as the Cloudflare
// Durable Object in server/relay/relay.js) on one port, with nothing to install. Open http://localhost:8787 in up to
// four windows (or on other machines on your network, at this machine's address): one hosts, the rest join with
// the code. The playtest uses it too.
// Usage: node scripts/coop-server.mjs [port]      (default 8787: the port the game looks for the relay on)
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PLAYERS = 4;
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

// ---------------------------------------------------------------- a minimal websocket (RFC 6455, text frames)
class Socket {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.open = true; this.att = null;
    this.onmessage = null; this.onclose = null;
    sock.on('data', (d) => { this.buf = Buffer.concat([this.buf, d]); this.parse(); });
    sock.on('close', () => this.closed());
    sock.on('error', () => this.closed());
  }
  parse() {
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const op = b[0] & 0x0f, masked = b[1] & 0x80; let len = b[1] & 0x7f, at = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); at = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); at = 10; }
      const mask = masked ? b.subarray(at, at + 4) : null; if (masked) at += 4;
      if (b.length < at + len) return;
      const data = Buffer.from(b.subarray(at, at + len));
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = b.subarray(at + len);
      if (op === 0x8) { this.close(1000, ''); return; }
      if (op === 0x9) { this.frame(0xa, data); continue; }
      if (op === 0x1 && this.onmessage) this.onmessage(data.toString('utf8'));
    }
  }
  frame(op, data) {
    if (!this.open) return;
    const n = data.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
    try { this.sock.write(Buffer.concat([head, data])); } catch {}
  }
  send(text) { this.frame(0x1, Buffer.from(text, 'utf8')); }
  close(code = 1000, why = '') {
    if (!this.open) return;
    const r = Buffer.from(why, 'utf8'), d = Buffer.alloc(2 + r.length); d.writeUInt16BE(code, 0); r.copy(d, 2);
    this.frame(0x8, d); this.open = false;
    setTimeout(() => this.sock.destroy(), 50);
    this.closed();
  }
  closed() { if (this.done) return; this.done = true; this.open = false; if (this.onclose) this.onclose(); }
}

// ---------------------------------------------------------------- rooms (as in server/relay/relay.js)
const rooms = new Map(); // code -> Set of sockets
const players = (code) => [...(rooms.get(code) || [])].filter((s) => s.att && s.att.id);
const lobby = (code) => {
  const msg = JSON.stringify({ t: 'lobby', players: players(code).map((s) => ({ id: s.att.id, host: s.att.host, name: s.att.name, look: s.att.look })) });
  for (const s of players(code)) s.send(msg);
};
function join(ws, code, role) {
  const list = players(code), host = list.find((s) => s.att.host);
  if (!rooms.has(code)) rooms.set(code, new Set());
  rooms.get(code).add(ws);
  const refuse = (c, why) => ws.close(c, why);
  if (role === 'host' && host) return refuse(4001, 'that code is taken, try again');
  if (role !== 'host' && !host) return refuse(4004, 'no game with that code');
  if (list.length >= MAX_PLAYERS) return refuse(4003, 'that game is full');
  ws.att = { id: Math.random().toString(36).slice(2, 8), host: role === 'host', name: 'guest', look: null };
  ws.send(JSON.stringify({ t: 'welcome', id: ws.att.id, host: ws.att.host }));
  ws.onmessage = (text) => {
    let msg; try { msg = JSON.parse(text); } catch { return; }
    if (msg.t === 'hello') { ws.att.name = String(msg.name || 'guest').slice(0, 16); ws.att.look = msg.look || null; lobby(code); return; }
    msg.from = ws.att.id;
    const out = JSON.stringify(msg);
    for (const p of players(code)) {
      if (p === ws) continue;
      if (msg.to && p.att.id !== msg.to) continue;
      if (msg.toHost && !p.att.host) continue;
      p.send(out);
    }
  };
  ws.onclose = () => {
    const me = ws.att; ws.att = null; rooms.get(code)?.delete(ws);
    if (me && me.host) { for (const p of players(code)) { p.send(JSON.stringify({ t: 'hostLeft' })); p.close(4010, 'the host left, so the game ended'); } rooms.delete(code); return; }
    if (players(code).length) lobby(code); else rooms.delete(code);
  };
}

// ---------------------------------------------------------------- the game's files, and the upgrade to a socket
export function startCoopServer(port = 8787, quiet = false) {
  const srv = http.createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    if (p.endsWith(path.sep) || (existsSync(p) && statSync(p).isDirectory())) p = path.join(p, 'index.html');
    if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(readFileSync(p));
  });
  srv.on('upgrade', (req, sock) => {
    const u = new URL(req.url, 'http://x'), code = (u.searchParams.get('code') || '').toUpperCase(), role = u.searchParams.get('role');
    if (u.pathname !== '/api/room' || !/^[A-Z0-9]{4,6}$/.test(code)) { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sock.setNoDelay(true);
    join(new Socket(sock), code, role);
  });
  return new Promise((resolve) => srv.listen(port, () => { if (!quiet) console.log(`Yoake co-op: http://localhost:${port} (game and relay)`); resolve(srv); }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) startCoopServer(+(process.argv[2] || 8787));
