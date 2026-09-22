"use strict";

/*
 * Game logic ported from the decompiled CoinGame.java / Coin.java of
 * Coins.jar ("Coin Game" by Alexander Bogomolny, cut-the-knot.org).
 *
 * Coins sit in a row (or a loop). Players alternately remove an end coin;
 * larger total wins. The human is "x" in the scores, the computer is "y".
 * The computer's strategy is the parity strategy: it works out whether the
 * even-numbered or the odd-numbered coins are worth more, and keeps taking
 * end coins of that parity; when the parity rule doesn't decide, it takes
 * the larger end coin.
 */

class Coin {
  constructor(value, index) {
    this.value = value;
    this.index = index;
    this.enabled = true;
    this.selected = false;
  }
}

class CoinGame {
  constructor(coins, loop = false) {
    this.coins = coins;
    this.n = coins.length;
    this.loop = loop;
    this.first = 0;
    this.last = this.n - 1;
    this.strategy = 0;
    this.justStarted = true;
    this.scores = { x: 0, y: 0 };
    this.selectStrategy(this.n);
  }

  // Sums the coins at alternating positions starting at `first`, and the
  // other alternating group; the larger group becomes the strategy parity.
  selectStrategy(count) {
    const n = this.n;
    let a = 0;
    let b = 0;
    for (let i = this.first; i < this.first + count; i += 2) a += this.coins[i % n].value;
    const s = (this.first + 1) % n;
    for (let i = s; i < s + count; i += 2) b += this.coins[i % n].value;
    this.strategy = a > b ? 0 : 1;
    return { x: a, y: b };
  }

  isTakeable(coin) {
    if (!coin.enabled) return false;
    if (this.loop && this.justStarted) return true;
    return coin.index === this.first || coin.index === this.last;
  }

  // The human clicks a coin. Returns "taken", or "illegal" if it isn't an end coin.
  humanTake(coin) {
    if (!coin.enabled) return "ignored";
    if (this.loop && this.justStarted) {
      this.justStarted = false;
      this.first = coin.index;
      this.last = (coin.index - 1 + this.n) % this.n;
    }
    if (coin.index === this.first) {
      coin.enabled = false;
      coin.selected = true;
      this.scores.x += coin.value;
      this.increaseFirst();
      return "taken";
    }
    if (coin.index === this.last) {
      coin.enabled = false;
      coin.selected = true;
      this.scores.x += coin.value;
      this.decreaseLast();
      return "taken";
    }
    return "illegal";
  }

  computerPlay() {
    let takeFirst;
    if (this.loop && this.justStarted) {
      this.selectBest();
      takeFirst = true;
      this.justStarted = false;
    } else {
      const f = this.first % 2 === this.strategy;
      const l = this.last % 2 === this.strategy;
      if (f && l) takeFirst = this.selectOne();
      else if (f) takeFirst = true;
      else if (l) takeFirst = false;
      else takeFirst = this.selectOne();
    }
    const coin = this.coins[takeFirst ? this.first : this.last];
    coin.enabled = false;
    this.scores.y += coin.value;
    if (takeFirst) this.increaseFirst();
    else this.decreaseLast();
    return coin;
  }

  // Larger end coin; a coin-flip when they are equal.
  selectOne() {
    const a = this.coins[this.first].value;
    const b = this.coins[this.last].value;
    if (a > b) return true;
    if (a < b) return false;
    return Math.random() < 0.5;
  }

  // Loop opening: look for a starting coin whose value outweighs the
  // advantage the opponent's parity strategy would get on the remaining row.
  selectBest() {
    const n = this.n;
    for (let k = 0; k < n; k++) {
      const v = this.coins[k].value;
      this.first = (k + 1) % n;
      this.last = (k - 1 + n) % n;
      const p = this.selectStrategy(n - 1);
      if (p.x > p.y && p.x < p.y + v) {
        this.strategy = (k % 2) + 1;
        this.first = k;
        this.last = (this.first - 1 + n) % n;
        return;
      }
      if (p.y > p.x && p.y < p.x + v) {
        this.strategy = k % 2;
        this.first = k;
        this.last = (this.first - 1 + n) % n;
        return;
      }
    }
    this.selectLargest();
  }

  selectLargest() {
    let best = 0;
    let bestValue = this.coins[0].value;
    for (let i = 1; i < this.n; i++) {
      if (this.coins[i].value > bestValue) {
        best = i;
        bestValue = this.coins[i].value;
      }
    }
    this.first = best;
    this.last = (this.first - 1 + this.n) % this.n;
  }

  isFinished() {
    return this.coins.every((c) => !c.enabled);
  }

  // Final tally: the human's coins vs. everything else.
  countPoints() {
    let x = 0;
    let y = 0;
    for (const c of this.coins) {
      if (c.selected) x += c.value;
      else y += c.value;
    }
    return { x, y };
  }

  increaseFirst() {
    this.first = (this.first + 1) % this.n;
  }

  decreaseLast() {
    this.last = (this.last - 1 + this.n) % this.n;
  }

  // "Repeat": replay the same coins from the start.
  renew() {
    for (const c of this.coins) {
      c.enabled = true;
      c.selected = false;
    }
    this.first = 0;
    this.last = this.n - 1;
    this.scores = { x: 0, y: 0 };
    this.justStarted = true;
    this.selectStrategy(this.n);
  }
}
