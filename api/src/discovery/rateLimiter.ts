type Bucket = {
  timestamps: number[];
};

/**
 * Simple sliding-window rate limiter (per host / global).
 * Default: 1 request / 2s per host, 30 req / minute global.
 */
export class RateLimiter {
  private readonly perHost = new Map<string, Bucket>();
  private readonly global: Bucket = { timestamps: [] };

  constructor(
    private readonly perHostMinIntervalMs: number = 2000,
    private readonly globalMaxPerMinute: number = 30,
  ) {}

  async waitFor(host: string): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.prune(this.global, now - 60_000);
      const hostBucket = this.perHost.get(host) ?? { timestamps: [] };
      this.prune(hostBucket, now - 60_000);

      const lastHost = hostBucket.timestamps[hostBucket.timestamps.length - 1] ?? 0;
      const hostWait = Math.max(0, this.perHostMinIntervalMs - (now - lastHost));

      let globalWait = 0;
      if (this.global.timestamps.length >= this.globalMaxPerMinute) {
        const oldest = this.global.timestamps[0] ?? now;
        globalWait = Math.max(0, 60_000 - (now - oldest));
      }

      const waitMs = Math.max(hostWait, globalWait);
      if (waitMs <= 0) {
        hostBucket.timestamps.push(now);
        this.perHost.set(host, hostBucket);
        this.global.timestamps.push(now);
        return;
      }

      await sleep(waitMs + 10);
    }
  }

  private prune(bucket: Bucket, cutoff: number) {
    bucket.timestamps = bucket.timestamps.filter((t) => t >= cutoff);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const discoveryRateLimiter = new RateLimiter();
