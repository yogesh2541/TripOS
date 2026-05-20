// In-process token-bucket rate limiter. Meta's per-phone-number limits are
// tier-based (250/1k/10k/100k recipients/24h), and per-second is ~50 msg/sec
// for healthy numbers. We default to a conservative 20 msg/sec global cap and
// a 4 msg/min cap per recipient to avoid spam-classification.
//
// This is intentionally process-local — when the deployment moves to Redis
// (BullMQ), swap this module for a Redis-backed implementation; the call
// sites don't need to change.

type Bucket = {
  tokens: number;
  refilledAt: number;
};

type LimiterConfig = {
  capacity: number;
  refillPerSecond: number;
};

const GLOBAL: LimiterConfig = { capacity: 20, refillPerSecond: 20 };
const PER_RECIPIENT: LimiterConfig = { capacity: 4, refillPerSecond: 4 / 60 };

const globalState: Bucket = { tokens: GLOBAL.capacity, refilledAt: Date.now() };
const recipientState = new Map<string, Bucket>();

function refill(bucket: Bucket, cfg: LimiterConfig) {
  const now = Date.now();
  const elapsedSec = (now - bucket.refilledAt) / 1000;
  if (elapsedSec <= 0) return;
  bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsedSec * cfg.refillPerSecond);
  bucket.refilledAt = now;
}

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterMs: number; scope: "global" | "recipient" };

export function takeWhatsappToken(phone: string): RateLimitDecision {
  refill(globalState, GLOBAL);
  if (globalState.tokens < 1) {
    return {
      ok: false,
      retryAfterMs: Math.ceil(((1 - globalState.tokens) / GLOBAL.refillPerSecond) * 1000),
      scope: "global",
    };
  }

  const recipient =
    recipientState.get(phone) ??
    (() => {
      const b: Bucket = { tokens: PER_RECIPIENT.capacity, refilledAt: Date.now() };
      recipientState.set(phone, b);
      return b;
    })();
  refill(recipient, PER_RECIPIENT);
  if (recipient.tokens < 1) {
    return {
      ok: false,
      retryAfterMs: Math.ceil(((1 - recipient.tokens) / PER_RECIPIENT.refillPerSecond) * 1000),
      scope: "recipient",
    };
  }

  globalState.tokens -= 1;
  recipient.tokens -= 1;
  return { ok: true };
}

export function snapshotRateLimiter() {
  refill(globalState, GLOBAL);
  return {
    global: { tokens: Number(globalState.tokens.toFixed(2)), capacity: GLOBAL.capacity },
    recipients: recipientState.size,
  };
}
