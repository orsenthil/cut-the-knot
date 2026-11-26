#!/usr/bin/env node
"use strict";

/*
 * Logic test for sorts/sorts-core.js.
 *
 *   node porting/check-sorts.mjs
 *
 * 1. Every algorithm sorts every kind of array the applet makes, for every
 *    size 2..60, and random arrays 200 times each.
 * 2. The counts behind the comparisons on the page: insertion sort and
 *    bubblesort make exactly one swap per inversion; insertion and
 *    bubblesort take n(n-1)/2 steps and selection n(n+1)/2 whatever the
 *    data; after heapsort's first pass the array is a max-heap.
 * 3. Insertion, selection and shellsort, step by step against a literal
 *    transcription of the applet's MakeOneStep / ComputeNext; bubblesort the
 *    same up to its last sweep, where the applet's never finishes; heapsort
 *    as the applet runs it leaves element 0 alone.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("sorts/sorts-core.js", "SortsCore");
const R = rng(12);
const inversions = (a) => { let k = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) k++; return k; };

{
  let ok = true, n0 = 0;
  for (let m = 0; m < 5; m++) for (let order = 0; order < 5; order++) for (let n = 2; n <= 60; n++) {
    const t = C.run(C.start({ method: m, order, n, same: true, random: R }), R);
    n0++;
    if (!t.alg.finished || !C.sorted(t.array) || t.array.slice().sort((x, y) => x - y).join() !== t.backup.slice().sort((x, y) => x - y).join()) ok = false;
  }
  for (let m = 0; m < 5; m++) for (let k = 0; k < 200; k++) {
    const t = C.run(C.start({ method: m, n: 2 + Math.floor(R() * 99), same: true, random: R }), R);
    n0++;
    if (!C.sorted(t.array)) ok = false;
  }
  check(`all five algorithms sort every kind and size of array (${n0} runs)`, ok);
}

{
  let swaps = true, steps = true, heap = true;
  for (let k = 0; k < 300; k++) {
    const n = 2 + Math.floor(R() * 50);
    const base = C.start({ n, same: true, random: R });
    const inv = inversions(base.array);
    const ins = C.run({ ...base, method: 0 }, R), bub = C.run({ ...base, method: 2 }, R), sel = C.run({ ...base, method: 1 }, R);
    if (ins.alg.swaps !== inv || bub.alg.swaps !== inv) swaps = false;
    if (ins.alg.steps !== n * (n - 1) / 2 || bub.alg.steps !== n * (n - 1) / 2 || sel.alg.steps !== n * (n + 1) / 2) steps = false;
    let h = { ...base, method: 4 };
    h = C.step(h, R);
    while (h.alg.firstPass) h = C.step(h, R);
    if (!h.array.every((x, i) => i === 0 || h.array[Math.floor((i - 1) / 2)] >= x)) heap = false;
  }
  check("insertion sort and bubblesort make exactly one swap per inversion", swaps);
  check("insertion and bubblesort take n(n-1)/2 steps, selection n(n+1)/2, whatever the data", steps);
  check("after heapsort's first pass the array is a max-heap", heap);
}

{
  // literal transcriptions
  function applet(method, a0, maxSteps) {
    const a = a0.slice(), n = a.length;
    let I = 0, J = 0, H = 0, fin = false, firstPass = true;
    const sw = (i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
    if (method === 0) { I = J = 1; }
    if (method === 3) { H = 1; while (H < n) H = 3 * H + 1; H = Math.floor(H / 3); I = J = H; }
    if (method === 4) { J = 0; I = Math.floor(n / 2); firstPass = true; }
    const siftdown = (l, u) => { let i = l; for (;;) { let c = 2 * i; if (c > u) break; if (c + 1 <= u && a[c + 1] > a[c]) c++; if (a[i] >= a[c]) break; sw(i, c); i = c; } };
    const states = [];
    for (let s = 0; s < maxSteps && !fin; s++) {
      if (method === 0) { if (J > 0) { if (a[J - 1] > a[J]) sw(J - 1, J); J--; if (J === 0) { I++; if (I === n) fin = true; else J = I; } } }
      else if (method === 1) { if (J < n) { if (a[J] < a[I]) sw(I, J); J++; if (J === n) { I++; if (I === n) fin = true; else J = I; } } }
      else if (method === 2) { if (J < n - 1 - I && a[J + 1] < a[J]) sw(J, J + 1); J++; if (J === n - 1 - I) { I++; if (I === n) fin = true; else J = 0; } }
      else if (method === 3) { if (J >= H && H >= 1) { if (!(a[J - H] < a[J])) sw(J - H, J); J -= H; if (J < H) { I++; if (I === n) { H = Math.floor(H / 3); if (H < 1) fin = true; else I = J = H; } else J = I; } } }
      else if (method === 4) {
        if (firstPass) { if (I > 0) siftdown(I, n - 1); } else if (I >= 2) { sw(1, I); siftdown(1, I - 1); }
        I--;
        if (firstPass) { if (I <= 0) { I = n - 1; firstPass = false; } } else if (I < 1) fin = true;
      }
      states.push(a.join());
    }
    return { states, fin, a };
  }
  let same = true, bubble = true, bubbleStuck = true, heapLeaves0 = true, heapWrong = 0;
  for (let k = 0; k < 400; k++) {
    const n = 2 + Math.floor(R() * 30), method = [0, 1, 3][k % 3];
    let s = C.start({ method, n, same: true, random: R });
    const lit = applet(method, s.array, 5000);
    const mine = [];
    s = C.step(s, R); mine.push(s.array.join());
    while (!s.alg.finished) { s = C.step(s, R); mine.push(s.array.join()); }
    if (mine.join("|") !== lit.states.join("|") || !lit.fin) same = false;
    // bubblesort: identical until the applet's last sweep, after which it never finishes
    const b0 = C.start({ method: 2, n, same: true, random: R });
    const lb = applet(2, b0.array, 5000);
    let bs = C.step(b0, R); const mb = [bs.array.join()];
    while (!bs.alg.finished) { bs = C.step(bs, R); mb.push(bs.array.join()); }
    if (lb.states.slice(0, mb.length).join("|") !== mb.join("|")) bubble = false;
    if (lb.fin) bubbleStuck = false;
    const h0 = C.start({ method: 4, n, random: R });
    const lh = applet(4, h0.array, 5000);
    if (lh.a[0] !== h0.array[0]) heapLeaves0 = false;
    if (!C.sorted(lh.a)) heapWrong++;
  }
  check("insertion, selection and shellsort match the applet step by step", same);
  check("bubblesort matches the applet's steps until it is sorted", bubble);
  check("the applet's own bubblesort never says it has finished", bubbleStuck);
  check("the applet's own heapsort never moves element 0", heapLeaves0);
  check("so it often leaves the array unsorted", heapWrong > 100, String(heapWrong));
}

{
  const s = C.start();
  equal("defaults: insertion sort, random order, 20 elements", `${s.method} ${s.order} ${s.n}`, "0 0 20");
  equal("ascending 0, 1/4, 2/4, 3/4 for 4", C.generate(4, 1, R).join(), "0,0.25,0.5,0.75");
  equal("convex for 4: 1, 1/4, 0, 1/4", C.generate(4, 4, R).join(), "1,0.25,0,0.25");
  equal("concave for 4: 0, 3/4, 1, 3/4", C.generate(4, 3, R).join(), "0,0.75,1,0.75");
  const a = C.begin({ ...s, same: true });
  check("Same array starts from the same numbers", JSON.stringify(C.begin({ ...a, same: true }).array) === JSON.stringify(a.array));
  check("without it, a new array", JSON.stringify(C.begin({ ...a, same: false }).array) !== JSON.stringify(a.array));
  equal("size is held to 2..100", `${C.set(s, { n: 1 }).n} ${C.set(s, { n: 500 }).n}`, "2 100");
  const before = JSON.stringify(a);
  C.step(a, R);
  equal("a step leaves the old position alone", JSON.stringify(a), before);
}

done("sorts");
