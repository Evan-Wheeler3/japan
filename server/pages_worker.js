// Deployed as the Pages site's _worker.js: serves the game files, and hands /api/room
// websockets to the co-op relay (a Durable Object in the my-cozy-diner-relay worker).
export default {
  fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/room') {
      const code = (url.searchParams.get('code') || '').toUpperCase();
      if (!/^[A-Z0-9]{4,6}$/.test(code)) return new Response('bad game code', { status: 400 });
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};
