import * as THREE from 'three';
import { iconUrl } from './icons';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const yen = (n: number) => `${n < 0 ? '-' : ''}¥${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export function starsHtml(rating: number): string {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return `<span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fg" style="width:${pct}%">★★★★★</span></span>`;
}

/** A DOM element pinned to a 3D point. */
export class WorldLabel {
  readonly el: HTMLDivElement;
  readonly anchor = new THREE.Vector3();
  visible = true;
  maxDistance = 14;

  constructor(cls: string) {
    this.el = el('div', `wlabel ${cls}`);
  }
}

export class LabelLayer {
  private readonly root: HTMLDivElement;
  private readonly labels = new Set<WorldLabel>();
  private readonly v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = el('div', 'labels', parent);
  }

  add(l: WorldLabel): WorldLabel {
    this.labels.add(l);
    this.root.appendChild(l.el);
    return l;
  }

  remove(l: WorldLabel): void {
    this.labels.delete(l);
    l.el.remove();
  }

  update(camera: THREE.Camera, show: boolean): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.root.style.display = show ? '' : 'none';
    if (!show) return;
    for (const l of this.labels) {
      const dist = camera.position.distanceTo(l.anchor);
      this.v.copy(l.anchor).project(camera);
      const onScreen = l.visible && this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2 && dist < l.maxDistance;
      if (!onScreen) {
        l.el.style.display = 'none';
        continue;
      }
      l.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      const scale = THREE.MathUtils.clamp(3.2 / dist, 0.55, 1.15);
      l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
      l.el.style.opacity = String(THREE.MathUtils.clamp((l.maxDistance - dist) / 3, 0, 1));
    }
  }
}

export class Ticket {
  readonly label = new WorldLabel('ticket');
  private readonly items: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private key = '';

  constructor() {
    this.items = el('div', 'ticket-items', this.label.el);
    this.bar = el('div', 'patience', this.label.el);
    this.fill = el('div', 'patience-fill', this.bar);
  }

  set(icons: { icon: string; name: string }[] | 'reading', patience: number | null, highlight: boolean): void {
    const key = icons === 'reading' ? 'reading' : icons.map((i) => i.icon).join(',');
    if (key !== this.key) {
      this.key = key;
      this.items.innerHTML =
        icons === 'reading' ? '<span class="dots">…</span>' : icons.map((i) => `<img src="${iconUrl(i.icon)}" alt="${esc(i.name)}" title="${esc(i.name)}">`).join('');
    }
    this.bar.style.display = patience === null ? 'none' : '';
    if (patience !== null) {
      this.fill.style.width = `${Math.max(0, patience) * 100}%`;
      this.fill.className = `patience-fill ${patience > 0.5 ? 'ok' : patience > 0.25 ? 'warn' : 'bad'}`;
    }
    this.label.el.classList.toggle('hl', highlight);
  }
}

export class StationBadge {
  readonly label = new WorldLabel('badge');

  set(progress: number | null, ready: number): void {
    if (progress !== null) {
      this.label.visible = true;
      this.label.el.innerHTML = `<div class="ring" style="--p:${Math.round(progress * 100)}"></div>`;
    } else if (ready > 0) {
      this.label.visible = true;
      this.label.el.innerHTML = `<div class="ready">✓${ready > 1 ? ` ×${ready}` : ''}</div>`;
    } else {
      this.label.visible = false;
    }
  }
}

export interface SummaryData {
  night: number;
  revenue: number;
  tips: number;
  ingredients: number;
  net: number;
  cash: number;
  served: number;
  lost: number;
  items: number;
  ratingBefore: number;
  ratingAfter: number;
  satisfaction: number | null;
  servedRatio: number | null;
}

export class UI {
  readonly root: HTMLDivElement;
  readonly labels: LabelLayer;
  private readonly hud: HTMLDivElement;
  private readonly hudCash: HTMLDivElement;
  private readonly hudTime: HTMLDivElement;
  private readonly hudStars: HTMLDivElement;
  private readonly hudPhase: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly held: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly legend: HTMLDivElement;
  private readonly titleScreen: HTMLDivElement;
  private readonly pauseScreen: HTMLDivElement;
  private readonly summaryScreen: HTMLDivElement;
  private readonly fade: HTMLDivElement;
  private promptKey = '';
  private heldKey = '';
  private objectiveKey = '';
  private cashShown = 0;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'ui', parent);
    this.labels = new LabelLayer(this.root);
    this.hud = el('div', 'hud panel', this.root);
    this.hudCash = el('div', 'hud-cash', this.hud);
    this.hudTime = el('div', 'hud-time', this.hud);
    this.hudStars = el('div', 'hud-stars', this.hud);
    this.hudPhase = el('div', 'hud-phase', this.hud);
    this.objective = el('div', 'objective', this.root);
    this.crosshair = el('div', 'crosshair', this.root);
    this.prompt = el('div', 'prompt', this.root);
    this.held = el('div', 'held panel', this.root);
    this.toasts = el('div', 'toasts', this.root);
    this.legend = el(
      'div',
      'legend',
      this.root,
      '<b>WASD</b> move · <b>Shift</b> run · <b>Click</b> use · <b>Q</b> set down · <b>Esc</b> pause',
    );
    this.titleScreen = el('div', 'screen title-screen', this.root);
    this.pauseScreen = el('div', 'screen pause-screen', this.root);
    this.summaryScreen = el('div', 'screen summary-screen', this.root);
    this.fade = el('div', 'fade', this.root);
    this.setPlaying(false);
  }

  setPlaying(playing: boolean): void {
    for (const e of [this.hud, this.objective, this.crosshair, this.prompt, this.held, this.legend]) e.style.visibility = playing ? 'visible' : 'hidden';
  }

  setLegendVisible(v: boolean): void {
    this.legend.classList.toggle('hidden', !v);
  }

  updateHud(cash: number, time: string, rating: number, phase: string, dt: number): void {
    this.cashShown += (cash - this.cashShown) * Math.min(1, dt * 8);
    if (Math.abs(cash - this.cashShown) < 1) this.cashShown = cash;
    this.hudCash.textContent = yen(this.cashShown);
    this.hudTime.textContent = time;
    const stars = starsHtml(rating);
    if (this.hudStars.innerHTML !== stars) this.hudStars.innerHTML = stars;
    this.hudPhase.textContent = phase;
  }

  snapCash(cash: number): void {
    this.cashShown = cash;
  }

  setObjective(text: string): void {
    if (text === this.objectiveKey) return;
    this.objectiveKey = text;
    this.objective.innerHTML = text ? `<span class="dot">◆</span>${esc(text)}` : '';
  }

  setPrompt(p: { title: string; verb?: string; detail?: string; ok: boolean } | null): void {
    const key = p ? `${p.title}|${p.verb}|${p.detail}|${p.ok}` : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    this.crosshair.classList.toggle('active', !!p);
    this.crosshair.classList.toggle('ok', !!p?.ok);
    if (!p) {
      this.prompt.innerHTML = '';
      return;
    }
    this.prompt.innerHTML =
      `<div class="p-title">${esc(p.title)}</div>` +
      (p.verb ? `<div class="p-verb ${p.ok ? 'ok' : 'no'}">${p.ok ? '<span class="mouse">◧</span> ' : ''}${esc(p.verb)}</div>` : '') +
      (p.detail ? `<div class="p-detail">${esc(p.detail)}</div>` : '');
  }

  flashReject(): void {
    this.prompt.classList.remove('shake');
    void this.prompt.offsetWidth;
    this.prompt.classList.add('shake');
  }

  setHeld(name: string | null, icon: string | null): void {
    const key = name ?? '';
    if (key === this.heldKey) return;
    this.heldKey = key;
    this.held.style.display = name ? '' : 'none';
    if (name && icon) this.held.innerHTML = `<img src="${iconUrl(icon)}"><span>${esc(name)}</span><span class="key">Q</span>`;
  }

  toast(text: string, kind: 'info' | 'big' = 'info', seconds = 3): void {
    const t = el('div', `toast ${kind}`, this.toasts, esc(text));
    setTimeout(() => t.classList.add('out'), seconds * 1000);
    setTimeout(() => t.remove(), seconds * 1000 + 600);
  }

  floater(anchor: THREE.Vector3, text: string, cls: string, seconds = 2.2): WorldLabel {
    const l = new WorldLabel(`floater ${cls}`);
    l.el.textContent = text;
    l.anchor.copy(anchor);
    this.labels.add(l);
    const start = anchor.y;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      l.anchor.y = start + t * 0.25;
      if (t < seconds) requestAnimationFrame(tick);
      else this.labels.remove(l);
    };
    requestAnimationFrame(tick);
    return l;
  }

  fadeTo(opacity: number, seconds: number): void {
    this.fade.style.transition = `opacity ${seconds}s ease`;
    this.fade.style.opacity = String(opacity);
  }

  // ---------- Screens ----------
  showTitle(hasSave: boolean, saveInfo: string, onContinue: () => void, onNew: () => void): void {
    this.titleScreen.innerHTML = `
      <div class="title-wrap">
        <div class="logo-jp">夜明け</div>
        <div class="logo">YOAKE</div>
        <div class="tagline">A small sushi bar at the edge of the sea. Work the night. Watch the dawn.</div>
        <div class="buttons">
          ${hasSave ? `<button class="btn primary" data-a="continue">Continue <small>${esc(saveInfo)}</small></button>` : ''}
          <button class="btn ${hasSave ? '' : 'primary'}" data-a="new">${hasSave ? 'New Game' : 'Begin'}</button>
        </div>
        <div class="hint">Best with headphones · Click to capture the mouse</div>
      </div>`;
    this.titleScreen.querySelector('[data-a="continue"]')?.addEventListener('click', onContinue);
    const newBtn = this.titleScreen.querySelector<HTMLButtonElement>('[data-a="new"]')!;
    let armed = !hasSave;
    newBtn.addEventListener('click', () => {
      // Two-step confirm in the page itself: browser confirm() dialogs are blocked in embedded viewers.
      if (!armed) {
        armed = true;
        newBtn.textContent = 'Erase save and start over?';
        newBtn.classList.add('danger');
        return;
      }
      onNew();
    });
    this.titleScreen.classList.add('show');
  }

  hideTitle(): void {
    this.titleScreen.classList.remove('show');
  }

  showPause(
    opts: { master: number; music: number; sensitivity: number; midShift: boolean },
    handlers: { resume: () => void; quit: () => void; change: (k: 'master' | 'music' | 'sensitivity', v: number) => void },
  ): void {
    this.pauseScreen.innerHTML = `
      <div class="panel pause-panel">
        <h2>Paused</h2>
        <label>Volume <input type="range" min="0" max="1" step="0.05" value="${opts.master}" data-k="master"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${opts.music}" data-k="music"></label>
        <label>Mouse <input type="range" min="0.3" max="2.5" step="0.05" value="${opts.sensitivity}" data-k="sensitivity"></label>
        <div class="buttons">
          <button class="btn primary" data-a="resume">Resume</button>
          <button class="btn" data-a="quit">Save &amp; Quit</button>
        </div>
        ${opts.midShift ? '<div class="hint">Quitting mid-shift restarts tonight from the beginning.</div>' : ''}
        <div class="controls">
          <div><b>WASD</b> Move</div><div><b>Mouse</b> Look</div><div><b>Left Click</b> Pick up / Place / Serve</div>
          <div><b>Shift</b> Run</div><div><b>Q</b> Set item down</div><div><b>Esc</b> Pause</div>
        </div>
      </div>`;
    this.pauseScreen.querySelector('[data-a="resume"]')!.addEventListener('click', handlers.resume);
    this.pauseScreen.querySelector('[data-a="quit"]')!.addEventListener('click', handlers.quit);
    this.pauseScreen.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((input) =>
      input.addEventListener('input', () => handlers.change(input.dataset.k as 'master' | 'music' | 'sensitivity', Number(input.value))),
    );
    this.pauseScreen.classList.add('show');
  }

  hidePause(): void {
    this.pauseScreen.classList.remove('show');
  }

  showSummary(d: SummaryData, onContinue: () => void): void {
    const delta = d.ratingAfter - d.ratingBefore;
    const bar = (label: string, v: number | null) =>
      v === null ? '' : `<div class="bar-row"><span>${label}</span><div class="bar"><div style="width:${Math.round(v * 100)}%"></div></div><span>${Math.round(v * 100)}%</span></div>`;
    this.summaryScreen.innerHTML = `
      <div class="panel summary-panel">
        <div class="eyebrow">Night ${d.night} · Closed</div>
        <h2>The sun is up.</h2>
        <div class="ledger">
          <div><span>Food &amp; drink sales</span><span>${yen(d.revenue)}</span></div>
          <div><span>Tips</span><span>${yen(d.tips)}</span></div>
          <div class="neg"><span>Ingredients bought</span><span>${yen(-d.ingredients)}</span></div>
          <div class="total"><span>Net profit</span><span>${yen(d.net)}</span></div>
          <div class="sub"><span>Cash on hand</span><span>${yen(d.cash)}</span></div>
        </div>
        <div class="service">
          <div class="svc-stats"><span><b>${d.served}</b> parties served</span><span><b>${d.lost}</b> walked out</span><span><b>${d.items}</b> dishes</span></div>
          ${bar('Satisfaction', d.satisfaction)}
          ${bar('Guests served', d.servedRatio)}
          <div class="rating-line">Reputation ${starsHtml(d.ratingAfter)} <span class="num">${d.ratingAfter.toFixed(2)}</span>
            <span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)}</span></div>
        </div>
        <div class="buttons"><button class="btn primary" data-a="next">Rest, then open for Night ${d.night + 1}</button></div>
      </div>`;
    this.summaryScreen.querySelector('[data-a="next"]')!.addEventListener('click', onContinue);
    this.summaryScreen.classList.add('show');
  }

  hideSummary(): void {
    this.summaryScreen.classList.remove('show');
  }
}
