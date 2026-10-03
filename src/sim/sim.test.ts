import { describe, expect, it } from 'vitest';
import { buildContent, stationChain, unlockedMenu, validateContent } from '../data/registry';
import { formatClock, NightClock, PRE_DAWN_SKY, skyProgress } from './clock';
import { NightLedger, nextRating, nightScore, satisfactionFor, tipFor } from './economy';
import { generateOrder, MAX_ORDER_ITEMS } from './orders';
import { Rng } from './rng';
import { pickArchetype, Spawner, volumeMultiplier } from './spawner';

const content = buildContent();
const cfg = content.night;

describe('content', () => {
  it('passes validation', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('resolves the full station chain for multi-step dishes', () => {
    expect(stationChain(content, 'nigiri_salmon')).toEqual(['sushi_board', 'rice_cooker']);
    expect(stationChain(content, 'tea_green')).toEqual(['kettle']);
  });

  it('unlocks the three night-1 dishes', () => {
    expect(unlockedMenu(content, 1, 1).map((m) => m.item)).toEqual(['tea_green', 'edamame', 'nigiri_salmon']);
  });
});

describe('clock', () => {
  it('formats 12-hour time across midnight', () => {
    expect(formatClock(cfg, 0)).toBe('11:00 PM');
    expect(formatClock(cfg, 60)).toBe('12:00 AM');
    expect(formatClock(cfg, 197)).toBe('2:17 AM');
  });

  it('advances at secondsPerGameHour and holds before sunrise', () => {
    const clock = new NightClock(cfg);
    clock.tick(cfg.secondsPerGameHour);
    expect(clock.minute).toBeCloseTo(60);
    clock.tick(cfg.secondsPerGameHour * 100);
    expect(clock.minute).toBe(cfg.holdMinute);
    expect(clock.isLastCall).toBe(true);
  });

  it('switches phases at their start minute', () => {
    const clock = new NightClock(cfg);
    expect(clock.phase().id).toBe('opening');
    clock.minute = 125;
    expect(clock.phase().id).toBe('peak');
  });

  it('brightens the sky only near dawn', () => {
    expect(skyProgress(cfg, 100)).toBe(0);
    expect(skyProgress(cfg, cfg.holdMinute)).toBeCloseTo(PRE_DAWN_SKY);
    expect(skyProgress(cfg, cfg.sunriseEndMinute)).toBe(1);
  });
});

describe('economy & rating', () => {
  it('rewards fast service with higher satisfaction and tips', () => {
    expect(satisfactionFor(0.1)).toBe(1);
    expect(satisfactionFor(0.9)).toBeLessThan(satisfactionFor(0.5));
    expect(tipFor(1000, 1, 0.1)).toBe(100);
    expect(tipFor(1000, 0.5, 0.1)).toBe(0);
  });

  it('tracks net profit', () => {
    const l = new NightLedger();
    l.recordPayment(1000, 100, 1);
    l.recordRestock(300);
    expect(l.net).toBe(800);
  });

  it('a perfect first night lands near 2 stars; a terrible one stays at 1', () => {
    const good = new NightLedger();
    for (let i = 0; i < 10; i++) good.recordPayment(500, 50, 1);
    const bad = new NightLedger();
    for (let i = 0; i < 10; i++) bad.recordWalkout();
    expect(nextRating(1, nightScore(good)!.score, 0.75)).toBeCloseTo(2);
    expect(nextRating(1, nightScore(bad)!.score, 0.75)).toBe(1);
    expect(nightScore(good)!.score).toBeGreaterThan(nightScore(bad)!.score);
  });

  it('leaves rating unchanged on a night with no customers', () => {
    expect(nextRating(3.2, nightScore(new NightLedger())?.score ?? null, 0.75)).toBe(3.2);
  });
});

describe('orders & spawning', () => {
  it('only orders available items and respects the size cap', () => {
    const rng = new Rng(42);
    for (const arch of content.archetypes.all()) {
      for (let i = 0; i < 50; i++) {
        const order = generateOrder(arch, arch.looks[0].length, ['tea_green', 'edamame'], rng);
        expect(order.length).toBeGreaterThan(0);
        expect(order.length).toBeLessThanOrEqual(MAX_ORDER_ITEMS);
        for (const item of order) expect(['tea_green', 'edamame']).toContain(item);
      }
    }
  });

  it('spawns roughly partiesPerHour over an hour and waits for a free table', () => {
    const rng = new Rng(7);
    const spawner = new Spawner(rng);
    const phase = cfg.phases[2];
    let spawned = 0;
    for (let m = 0; m < 600; m++) if (spawner.tick(1, phase, 1, true)) spawned++;
    expect(spawned).toBeGreaterThan(phase.partiesPerHour * 10 * 0.7);
    expect(spawned).toBeLessThan(phase.partiesPerHour * 10 * 1.3);

    const blocked = new Spawner(new Rng(1));
    for (let m = 0; m < 600; m++) expect(blocked.tick(1, phase, 1, false)).toBe(false);
  });

  it('caps nightly volume growth', () => {
    expect(volumeMultiplier(cfg, 1)).toBe(1);
    expect(volumeMultiplier(cfg, 100)).toBe(cfg.maxVolumeMultiplier);
  });

  it('weights archetypes by phase', () => {
    const rng = new Rng(3);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const a = pickArchetype(content.archetypes.all(), 'late', rng);
      counts[a.id] = (counts[a.id] ?? 0) + 1;
    }
    expect(counts.salaryman).toBeGreaterThan(counts.family);
  });
});
