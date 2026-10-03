const ART: Record<string, { rows: string[]; palette: Record<string, string> }> = {
  tea: {
    rows: ['..w..w....', '...w..w...', '..........', '.cccccccc.', '.cGGGGGGc.', '.cccccccc.', '.cccccccc.', '..cccccc..', '..cccccc..', '...cccc...'],
    palette: { c: '#6d7a5a', G: '#a8cf62', w: '#dfe6ee' },
  },
  edamame: {
    rows: ['..........', '..gg......', '.gGGg..gg.', '.gGGgggGGg', '..ggGGgGGg', '....gGGgg.', '.....gg...', 'pppppppppp', '.pppppppp.', '..........'],
    palette: { g: '#4f8a2c', G: '#86c452', p: '#efe9dc' },
  },
  rice: {
    rows: ['..........', '...wwww...', '..wwwwww..', '.wwwwwwww.', '.bbbbbbbb.', '.bBbbbbbb.', '..bbbbbb..', '...bbbb...', '....bb....', '..........'],
    palette: { w: '#fbf8ee', b: '#2b2f3a', B: '#4a5060' },
  },
  nigiriSalmon: {
    rows: ['..........', '..........', '.oooo.oooo', '.oOoo.oOoo', '.wwww.wwww', '.wwww.wwww', '..........', 'kkkkkkkkkk', '.k......k.', '..........'],
    palette: { o: '#f08a4a', O: '#fbd2b0', w: '#fbf8ee', k: '#8a5a32' },
  },
  dirty: {
    rows: ['..........', '......cc..', '......cc..', '.pppppcc..', 'pppppppppp', '.dddddddd.', 'pppppppppp', '.dddddddd.', 'pppppppppp', '..........'],
    palette: { p: '#c8c0b0', d: '#9a9284', c: '#6d7a5a' },
  },
};

const cache = new Map<string, string>();

/** Pixel-art icon as a data URL; scale with CSS `image-rendering: pixelated`. */
export function iconUrl(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const art = ART[id];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 10;
  const ctx = canvas.getContext('2d')!;
  if (art) {
    art.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const c = art.palette[ch];
        if (!c) return;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  } else {
    ctx.fillStyle = '#f0b45a';
    ctx.fillRect(2, 2, 6, 6);
  }
  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}
