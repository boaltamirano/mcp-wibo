import { CACHE_TTL } from "./config.js";

class MemoryCache {
  constructor() { this.store = new Map(); }

  get(key) {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return undefined; }
    return e.value;
  }

  set(key, value, ttl = CACHE_TTL) {
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  clear() { this.store.clear(); }

  stats() {
    let valid = 0;
    const now = Date.now();
    for (const [, e] of this.store) if (now <= e.expiresAt) valid++;
    return { entries: valid, size: this.store.size };
  }
}

export const cache = new MemoryCache();

export async function cached(key, fn, ttl = CACHE_TTL) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}
