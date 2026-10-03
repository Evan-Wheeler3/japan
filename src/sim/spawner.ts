import type { ArchetypeDef, NightConfig, PhaseDef } from '../data/types';
import type { Rng } from './rng';

/**
 * Accumulates "expected arrivals" from the phase spawn rate and releases one party
 * whenever the jittered threshold is crossed and a table is free.
 */
export class Spawner {
  private acc: number;
  private threshold: number;

  constructor(private readonly rng: Rng) {
    this.threshold = this.nextThreshold();
    this.acc = this.threshold * 0.85;
  }

  private nextThreshold(): number {
    return this.rng.range(0.6, 1.4);
  }

  tick(gameMinutes: number, phase: PhaseDef, volume: number, tableFree: boolean): boolean {
    this.acc += (gameMinutes / 60) * phase.partiesPerHour * volume;
    if (this.acc < this.threshold) return false;
    if (!tableFree) {
      this.acc = Math.min(this.acc, this.threshold + 0.5);
      return false;
    }
    this.acc -= this.threshold;
    this.threshold = this.nextThreshold();
    return true;
  }
}

export function volumeMultiplier(cfg: NightConfig, night: number): number {
  return Math.min(cfg.maxVolumeMultiplier, 1 + cfg.volumeGrowthPerNight * (night - 1));
}

export function pickArchetype(archetypes: ArchetypeDef[], phaseId: string, rng: Rng): ArchetypeDef {
  const picked = rng.weighted(archetypes.map((a) => [a, a.baseSpawnWeight * (a.spawnWeight[phaseId] ?? 1)] as const));
  return picked ?? archetypes[0];
}
