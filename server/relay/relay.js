// Co-op relay: one Durable Object per game code. It keeps the lobby list and passes messages between
// the players; the host's browser runs the actual shop. Reached at /api/room?code=ABCD&role=host|join
// (through the Pages site's _worker.js in production, or directly from `wrangler dev` locally).

const MAX_PLAYERS = 4;

export class Room {
  constructor(state) { this.state = state; }

  players() {
    return this.state.getWebSockets().map((ws) => ({ ws, ...(ws.deserializeAttachment() || {}) })).filter((p) => p.id);
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
    const role = new URL(req.url).searchParams.get('role');
    const players = this.players();
    const host = players.find((p) => p.host);
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    const refuse = (code, why) => { server.close(code, why); return new Response(null, { status: 101, webSocket: client }); };
    if (role === 'host' && host) return refuse(4001, 'that code is taken, try again');
    if (role !== 'host' && !host) return refuse(4004, 'no game with that code');
    if (players.length >= MAX_PLAYERS) return refuse(4003, 'that game is full');
    const id = Math.random().toString(36).slice(2, 8);
    server.serializeAttachment({ id, host: role === 'host', name: 'guest', look: null });
    server.send(JSON.stringify({ t: 'welcome', id, host: role === 'host' }));
    return new Response(null, { status: 101, webSocket: client });
  }

  lobby() {
    const players = this.players();
    const msg = JSON.stringify({ t: 'lobby', players: players.map(({ id, host, name, look }) => ({ id, host, name, look })) });
    for (const p of players) try { p.ws.send(msg); } catch {}
  }

  async webSocketMessage(ws, data) {
    const me = ws.deserializeAttachment();
    if (!me || !me.id) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.t === 'hello') {
      me.name = String(msg.name || 'guest').slice(0, 16); me.look = msg.look || null;
      ws.serializeAttachment(me);
      this.lobby();
      return;
    }
    msg.from = me.id;
    const out = JSON.stringify(msg);
    for (const p of this.players()) {
      if (p.ws === ws) continue;
      if (msg.to && p.id !== msg.to) continue;
      if (msg.toHost && !p.host) continue;
      try { p.ws.send(out); } catch {}
    }
  }

  async webSocketClose(ws) { this.left(ws); }
  async webSocketError(ws) { this.left(ws); }
  left(ws) {
    const me = ws.deserializeAttachment();
    ws.serializeAttachment(null);
    try { ws.close(1000, 'bye'); } catch {}
    if (me && me.host) {
      // no host, no shop: send everyone home
      for (const p of this.players()) { try { p.ws.send(JSON.stringify({ t: 'hostLeft' })); p.ws.close(4010, 'the host left, so the shop closed for the night'); } catch {} }
      return;
    }
    this.lobby();
  }
}

// Route a /api/room request to its room (used when running this worker on its own with `wrangler dev`;
// the deployed site does the same thing in server/pages_worker.js).
export function roomRequest(req, env) {
  const code = (new URL(req.url).searchParams.get('code') || '').toUpperCase();
  if (!/^[A-Z0-9]{4,6}$/.test(code)) return new Response('bad game code', { status: 400 });
  return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
}

export default {
  fetch(req, env) {
    if (new URL(req.url).pathname === '/api/room') return roomRequest(req, env);
    return new Response('yoake relay', { status: 404 });
  },
};
