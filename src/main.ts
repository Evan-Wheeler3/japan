import '@fontsource/dotgothic16';
import './style.css';
import { Game } from './app/Game';

async function boot() {
  // Canvas-drawn signs need the pixel font loaded first; fall back to system fonts after a short wait.
  await Promise.race([document.fonts.load('24px "DotGothic16"', '寿司ABC'), new Promise((r) => setTimeout(r, 1500))]).catch(() => undefined);
  new Game(document.getElementById('app')!).start();
}

void boot();
