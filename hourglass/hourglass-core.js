"use strict";

/*
 * Pure logic for the hourglass puzzle (no DOM), so it can be tested in Node.
 *
 * Two hourglasses hold `a` and `b` minutes of sand. A glass is described by
 * how much sand is on top (`ta`, `tb`); the rest is at the bottom, so
 * top + bottom is always the glass's capacity. Time only passes when the
 * player waits, and then only until the next glass runs out, so every state
 * value stays a whole number. Flipping swaps top and bottom.
 */
const HourglassCore = (() => {
  const ACTIONS = ["flipA", "flipB", "eggIn", "eggOut", "wait"];
  const MAX_FLIPS = 16;

  // egg: 0 = not in the pot, 1 = cooking, 2 = taken out
  function start() {
    return { ta: 0, tb: 0, egg: 0, cooked: 0, flips: 0, elapsed: 0, dt: 0 };
  }

  // Minutes until the first running glass empties (0 if nothing is running).
  function nextRun(s) {
    const runs = [];
    if (s.ta > 0) runs.push(s.ta);
    if (s.tb > 0) runs.push(s.tb);
    return runs.length ? Math.min(...runs) : 0;
  }

  // Returns the new state, or null if the action isn't allowed.
  function apply(s, act, caps) {
    const n = { ...s, dt: 0 };
    switch (act) {
      case "flipA":
        n.ta = caps.a - s.ta;
        n.flips++;
        return n;
      case "flipB":
        n.tb = caps.b - s.tb;
        n.flips++;
        return n;
      case "eggIn":
        if (s.egg !== 0) return null;
        n.egg = 1;
        return n;
      case "eggOut":
        if (s.egg !== 1) return null;
        n.egg = 2;
        return n;
      case "wait": {
        const dt = nextRun(s);
        if (dt === 0) return null;
        if (s.ta > 0) n.ta -= dt;
        if (s.tb > 0) n.tb -= dt;
        n.elapsed += dt;
        if (s.egg === 1) n.cooked += dt;
        n.dt = dt;
        return n;
      }
      default:
        return null;
    }
  }

  class MinHeap {
    constructor() {
      this.items = [];
    }
    get size() {
      return this.items.length;
    }
    push(item) {
      const a = this.items;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].cost <= a[i].cost) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.items;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && a[l].cost < a[m].cost) m = l;
          if (r < a.length && a[r].cost < a[m].cost) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    }
  }

  // Dijkstra over (top of A, top of B, egg state, minutes cooked). Fewest
  // flips first, then least total waiting. Returns null if it can't be done.
  function solve(caps, target) {
    const key = (s) => `${s.ta},${s.tb},${s.egg},${s.cooked}`;
    const costOf = (s) => s.flips * 100000 + s.elapsed;
    const s0 = start();
    const k0 = key(s0);
    const best = new Map([[k0, 0]]);
    const info = new Map([[k0, { state: s0, parent: null, act: null, before: null }]]);
    const heap = new MinHeap();
    heap.push({ cost: 0, k: k0 });

    while (heap.size) {
      const { cost, k } = heap.pop();
      if (cost > best.get(k)) continue;
      const cur = info.get(k).state;
      if (cur.egg === 2) {
        if (cur.cooked === target) return buildResult(info, k, cur);
        continue;
      }
      for (const act of ACTIONS) {
        const n = apply(cur, act, caps);
        if (!n || n.cooked > target || n.flips > MAX_FLIPS) continue;
        const nk = key(n);
        const c = costOf(n);
        if (!best.has(nk) || c < best.get(nk)) {
          best.set(nk, c);
          info.set(nk, { state: n, parent: k, act, before: cur });
          heap.push({ cost: c, k: nk });
        }
      }
    }
    return null;
  }

  function buildResult(info, k, finalState) {
    const steps = [];
    for (let node = info.get(k); node.parent !== null; node = info.get(node.parent)) {
      steps.push({ act: node.act, before: node.before, after: node.state });
    }
    steps.reverse();
    return { flips: finalState.flips, elapsed: finalState.elapsed, steps };
  }

  function describe(step, caps) {
    const { act, before, after } = step;
    const name = (w) => `${w === "a" ? caps.a : caps.b}-minute`;
    if (act === "flipA" || act === "flipB") {
      const w = act === "flipA" ? "a" : "b";
      const cap = w === "a" ? caps.a : caps.b;
      const top = before["t" + w];
      if (top === 0) return `Turn the ${name(w)} glass over to start it.`;
      return `Turn the ${name(w)} glass over: ${top} min are still on top, so it will now run for ${cap - top} more.`;
    }
    if (act === "eggIn") return "Put the egg in.";
    if (act === "eggOut") return "Take the egg out.";
    const dt = after.dt;
    const aEnds = before.ta === dt;
    const bEnds = before.tb === dt;
    if (aEnds && bEnds) return `Wait ${dt} min until both glasses run out.`;
    const w = aEnds ? "a" : "b";
    const otherLeft = w === "a" ? before.tb - dt : before.ta - dt;
    const other = w === "a" ? "b" : "a";
    const tail = otherLeft > 0 ? ` The ${name(other)} glass will then have ${otherLeft} min left on top.` : "";
    return `Wait ${dt} min until the ${name(w)} glass runs out.${tail}`;
  }

  return { start, nextRun, apply, solve, describe };
})();
