export class NightLedger {
  revenue = 0;
  tips = 0;
  ingredientSpend = 0;
  partiesServed = 0;
  partiesLost = 0;
  itemsServed = 0;
  satisfactionSum = 0;

  recordPayment(bill: number, tip: number, satisfaction: number): void {
    this.revenue += bill;
    this.tips += tip;
    this.partiesServed++;
    this.satisfactionSum += satisfaction;
  }

  recordWalkout(): void {
    this.partiesLost++;
  }

  recordRestock(cost: number): void {
    this.ingredientSpend += cost;
  }

  get partiesTotal(): number {
    return this.partiesServed + this.partiesLost;
  }

  /** Walkouts count as zero satisfaction. */
  get avgSatisfaction(): number {
    return this.partiesTotal === 0 ? 0 : this.satisfactionSum / this.partiesTotal;
  }

  get servedRatio(): number {
    return this.partiesTotal === 0 ? 0 : this.partiesServed / this.partiesTotal;
  }

  get net(): number {
    return this.revenue + this.tips - this.ingredientSpend;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** waitFraction = share of the patience budget used before the order was complete (0..1). */
export function satisfactionFor(waitFraction: number): number {
  return clamp(1 - Math.max(0, waitFraction - 0.25) * 0.8, 0.4, 1);
}

export function tipFor(bill: number, satisfaction: number, tipRate: number): number {
  const factor = clamp((satisfaction - 0.5) / 0.5, 0, 1);
  return Math.round((bill * tipRate * factor) / 10) * 10;
}

export interface NightScore {
  score: number;
  satisfaction: number;
  served: number;
}

/** MVP rating terms from the blueprint (Section 14): satisfaction + share of parties served. */
export function nightScore(l: NightLedger): NightScore | null {
  if (l.partiesTotal === 0) return null;
  const satisfaction = l.avgSatisfaction;
  const served = l.servedRatio;
  return { score: 0.6 * satisfaction + 0.4 * served, satisfaction, served };
}

export function nextRating(old: number, score: number | null, momentum: number): number {
  if (score === null) return old;
  return clamp(old * momentum + score * 5 * (1 - momentum), 1, 5);
}
