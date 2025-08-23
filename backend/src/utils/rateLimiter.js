// backend/src/utils/rateLimiter.js
class RateLimiter {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per time period
    this.lastRefill = Date.now();
  }

  async waitForSlot() {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }
    
    // Calculate wait time
    const waitTime = Math.ceil((1 / this.refillRate) * 1000);
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.refill();
        this.tokens -= 1;
        resolve();
      }, waitTime);
    });
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 1000) * (this.capacity / this.refillRate));
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getRemaining() {
    this.refill();
    return this.tokens;
  }
}

module.exports = { RateLimiter };