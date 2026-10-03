// Co-op connection: a websocket to this game's room on the relay. The host's game is the real diner;
// everyone else sends what they click to the host and mirrors what the host sends back.

// the relay lives at /api/room on the deployed site; locally `wrangler dev` runs it on port 8787
const relayURL = () => {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (local && location.port !== '8788') return `ws://${location.hostname}:8787/api/room`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/room`;
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to mix up
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export class Net {
  constructor() {
    this.id = null; this.isHost = false; this.players = []; this.code = null;
    this.handlers = {}; // t -> fn(msg)
    this.onLobby = null; this.onClose = null;
  }
  on(t, fn) { this.handlers[t] = fn; }

  // resolves once the relay has let us in; rejects with a readable reason
  connect(code, role, profile) {
    this.code = code.toUpperCase();
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${relayURL()}?code=${encodeURIComponent(this.code)}&role=${role}`);
      let joined = false;
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.t === 'welcome') {
          this.id = msg.id; this.isHost = msg.host; joined = true;
          this.send({ t: 'hello', name: profile.name, look: profile.look });
          resolve();
        } else if (msg.t === 'lobby') {
          this.players = msg.players;
          if (this.onLobby) this.onLobby(this.players);
        } else if (this.handlers[msg.t]) this.handlers[msg.t](msg);
      };
      ws.onclose = (e) => {
        const why = e.reason || (e.code === 1006 ? "couldn't reach the co-op server" : 'disconnected');
        if (!joined) reject(new Error(why));
        else if (this.onClose) this.onClose(why);
      };
      ws.onerror = () => {};
    });
  }
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  sendTo(id, msg) { this.send({ ...msg, to: id }); }
  sendHost(msg) { this.send({ ...msg, toHost: true }); }
  close() { if (this.ws) { this.ws.onclose = null; this.ws.close(); } this.ws = null; }
  nameOf(id) { const p = this.players.find((q) => q.id === id); return p ? p.name : 'someone'; }
}
