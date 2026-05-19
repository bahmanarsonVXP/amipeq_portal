/**
 * Rate limiter to ensure minimum delay between API requests
 * Prevents hitting TWENTY CRM rate limits
 */
class RateLimiter {
  constructor(delayMs = 650) {
    this.delayMs = delayMs;
    this.lastRequestTime = 0;
  }

  /**
   * Wait if necessary to maintain minimum delay between requests
   * Call this before making any API request
   */
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.delayMs) {
      const waitTime = this.delayMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

// Export singleton instance
module.exports = new RateLimiter(200);
