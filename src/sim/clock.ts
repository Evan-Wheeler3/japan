import type { NightConfig, PhaseDef } from '../data/types';

/** Value of skyProgress at the moment the sunrise sequence begins. */
export const PRE_DAWN_SKY = 0.22;

export class NightClock {
  minute = 0;

  constructor(private readonly cfg: NightConfig) {}

  /** Advances the clock; it never passes holdMinute on its own — the sunrise sequence takes over from there. */
  tick(realSeconds: number, speed = 1): number {
    const before = this.minute;
    const delta = (realSeconds * speed * 60) / this.cfg.secondsPerGameHour;
    this.minute = Math.min(this.cfg.holdMinute, this.minute + delta);
    return this.minute - before;
  }

  get isLastCall(): boolean {
    return this.minute >= this.cfg.lastCallMinute;
  }

  phase(): PhaseDef {
    return phaseAt(this.cfg, this.minute);
  }

  label(): string {
    return formatClock(this.cfg, this.minute);
  }
}

export function phaseAt(cfg: NightConfig, minute: number): PhaseDef {
  let current = cfg.phases[0];
  for (const p of cfg.phases) if (p.startMinute <= minute) current = p;
  return current;
}

export function formatClock(cfg: NightConfig, minute: number): string {
  const total = (cfg.startClockMinute + Math.floor(minute)) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** 0 = deep night, PRE_DAWN_SKY = first light, 1 = sun fully risen. */
export function skyProgress(cfg: NightConfig, minute: number): number {
  if (minute <= cfg.preDawnStartMinute) return 0;
  if (minute <= cfg.holdMinute) {
    return (PRE_DAWN_SKY * (minute - cfg.preDawnStartMinute)) / (cfg.holdMinute - cfg.preDawnStartMinute);
  }
  const t = Math.min(1, (minute - cfg.holdMinute) / (cfg.sunriseEndMinute - cfg.holdMinute));
  return PRE_DAWN_SKY + (1 - PRE_DAWN_SKY) * t;
}
