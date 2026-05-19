interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

// Singleton — persiste entre les requêtes d'une même instance Worker
export const cache = new MemoryCache()

export const TTL = {
  HISTORIQUE: 24 * 60 * 60 * 1000,  // 24h — N-1, N-2
  COURANT:     5 * 60 * 1000,        // 5 min — année courante
  PRIOS:       2 * 60 * 1000,        // 2 min — relances
}
