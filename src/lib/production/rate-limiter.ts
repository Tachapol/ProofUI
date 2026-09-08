import { MAX_PAYLOAD_SIZE_BYTES } from "./schemas";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private requests: Map<string, RateLimitRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 60, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public check(identifier: string): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now >= record.resetAt) {
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true, remaining: this.maxRequests - 1, resetInMs: this.windowMs };
    }

    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInMs: Math.max(0, record.resetAt - now),
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetInMs: Math.max(0, record.resetAt - now),
    };
  }

  public reset(): void {
    this.requests.clear();
  }
}

export const productionTelemetryLimiter = new RateLimiter(60, 60_000);

export function isPayloadSizeValid(contentLengthOrSize: number): boolean {
  return contentLengthOrSize <= MAX_PAYLOAD_SIZE_BYTES;
}
