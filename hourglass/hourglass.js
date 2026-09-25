"use strict";

/*
 * Browser UI for the hourglass puzzle. The solver and step descriptions live
 * in hourglass-core.js.
 *
 * There is no rush. Turning a glass starts its sand falling straight away
 * (one puzzle minute takes 1/MIN_PER_SEC real seconds), and time stops by
 * itself the moment any glass runs out. While stopped you can take as long as
 * you like: turn glasses, put the egg in or take it out, or press Continue to
 * let the remaining sand fall. Time also stands still whenever no sand is
 * falling. Putting the egg in or out never starts time; turning a glass does.
 *
 * To start both glasses together, just turn them one right after the other: if you
 * act while sand is falling, an action made within SNAP minutes (a few seconds)
 * after your previous action counts as happening at that same moment. So does an
 * action made within one minute before a glass is about to run out.
 */

const Core = HourglassCore;

const MIN_PER_SEC = 1 / 1.2;
const SNAP = 3.0;
const SNAP_AHEAD = 1.0;
const EPS = 1e-9;
const MAX_FRAME_S = 0.25;
const WIN_TOLERANCE = 0.05;

const el = (id) => document.getElementById(id);
const aInput = el("aInput");
const bInput = el("bInput");
const tInput = el("tInput");
const puzzleSelect = el("puzzleSelect");
const customFields = el("customFields");
const eggBtn = el("eggBtn");
const resetBtn = el("resetBtn");
const continueBtn = el("continueBtn");
const solutionBtn = el("solutionBtn");
const statusEl = el("status");
const clockEl = el("clock");
const logEl = el("log");
const solutionEl = el("solution");
const eggBox = el("eggBox");
const eggState = el("eggState");
const flipCount = el("flipCount");

const glasses = {
  a: { box: el("glassA"), svg: null, flipBtn: el("flipA"), label: el("labelA") },
  b: { box: el("glassB"), svg: null, flipBtn: el("flipB"), label: el("labelB") },
};

let caps, target, L, anchor, finished, running, logItems, renderedLogCount, lastNow;
let uid = 0;

// ---- drawing ----

function glassMarkup(cap) {
  const id = ++uid;
  const W = 100;
  const H = 110 + cap * 5;
  const neck = 6;
  const ch = (H - neck) / 2;
  const topShape = `M8 0 L92 0 L${50 + neck / 2} ${ch} L${50 - neck / 2} ${ch} Z`;
  const botShape = `M${50 - neck / 2} ${ch + neck} L${50 + neck / 2} ${ch + neck} L92 ${H} L8 ${H} Z`;
  return `
    <svg viewBox="-4 -12 ${W + 8} ${H + 24}" width="${W}" role="img" aria-hidden="true">
      <defs>
        <clipPath id="ct${id}"><path d="${topShape}"/></clipPath>
        <clipPath id="cb${id}"><path d="${botShape}"/></clipPath>
      </defs>
      <rect x="0" y="-10" width="${W}" height="9" rx="3" class="hg-cap"/>
      <rect x="0" y="${H + 1}" width="${W}" height="9" rx="3" class="hg-cap"/>
      <rect class="sandTop" x="0" width="${W}" fill="#d9a441" clip-path="url(#ct${id})"/>
      <rect class="sandBot" x="0" width="${W}" fill="#d9a441" clip-path="url(#cb${id})"/>
      <line class="stream" x1="50" x2="50" stroke="#b8862b" stroke-width="2.5" stroke-dasharray="3 3" visibility="hidden"/>
      <path d="${topShape}" class="hg-glass" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${botShape}" class="hg-glass" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>`;
}

function setLevels(which, top) {
  const cap = caps[which];
  const svg = glasses[which].svg;
  const H = 110 + cap * 5;
  const neck = 6;
  const ch = (H - neck) / 2;
  const topFrac = top / cap;
  const botFrac = (cap - top) / cap;
  const sandTop = svg.querySelector(".sandTop");
  const sandBot = svg.querySelector(".sandBot");
  sandTop.setAttribute("y", ch - topFrac * ch);
  sandTop.setAttribute("height", topFrac * ch);
  sandBot.setAttribute("y", H - botFrac * ch);
  sandBot.setAttribute("height", botFrac * ch);
  const stream = svg.querySelector(".stream");
  stream.setAttribute("visibility", top > EPS && !finished ? "visible" : "hidden");
  stream.setAttribute("y1", ch);
  stream.setAttribute("y2", H - botFrac * ch);
}

const fmt = (x) => String(Math.round(x * 10) / 10);

function render() {
  setLevels("a", L.ta);
  setLevels("b", L.tb);
  eggBox.dataset.state = String(L.egg);
  eggState.textContent = L.egg === 0 ? "Not in the pot" : L.egg === 1 ? "Cooking…" : "Out of the pot";
  flipCount.textContent = String(L.flips);
  const sand = runningTime() > 0;
  clockEl.textContent = finished
    ? ""
    : running
      ? "Sand is falling…"
      : sand
        ? "Time is stopped. Take your time — turn a glass, use the egg, or press Continue."
        : "Time is stopped — no sand is falling. Turn a glass to start it.";
  continueBtn.hidden = finished || running || !sand;
  if (logItems.length !== renderedLogCount) {
    logEl.innerHTML = "";
    for (const item of logItems) {
      const li = document.createElement("li");
      li.textContent = item;
      logEl.appendChild(li);
    }
    logEl.parentElement.hidden = logItems.length === 0;
    renderedLogCount = logItems.length;
  }
  glasses.a.flipBtn.disabled = finished;
  glasses.b.flipBtn.disabled = finished;
  eggBtn.disabled = finished;
  eggBtn.textContent = L.egg === 0 ? "Put the egg in" : "Take the egg out";
}

function flash(which) {
  const box = glasses[which].box;
  box.classList.add("ran-out");
  setTimeout(() => box.classList.remove("ran-out"), 900);
}

function spin(which) {
  const svg = glasses[which].svg;
  svg.classList.remove("turned");
  void svg.getBoundingClientRect();
  svg.classList.add("turned");
}

// ---- the clock ----

function copyState(s) {
  return { ...s };
}

function log(text) {
  logItems.push(text);
}

// Minutes until the first falling glass empties (0 if no sand is falling).
function runningTime() {
  const runs = [];
  if (L.ta > EPS) runs.push(L.ta);
  if (L.tb > EPS) runs.push(L.tb);
  return runs.length ? Math.min(...runs) : 0;
}

function advance(dt) {
  while (dt > EPS && !finished) {
    const r = runningTime();
    if (r === 0) return;
    const step = Math.min(dt, r);
    const aRuns = L.ta > EPS;
    const bRuns = L.tb > EPS;
    if (aRuns) L.ta -= step;
    if (bRuns) L.tb -= step;
    if (L.ta < EPS) L.ta = 0;
    if (L.tb < EPS) L.tb = 0;
    if (L.egg === 1) L.cooked += step;
    L.vt += step;
    dt -= step;
    const aRan = aRuns && L.ta === 0;
    const bRan = bRuns && L.tb === 0;
    if (aRan) {
      log(`The ${caps.a}-minute glass ran out.`);
      flash("a");
    }
    if (bRan) {
      log(`The ${caps.b}-minute glass ran out.`);
      flash("b");
    }
    if (aRan || bRan) {
      anchor = { vt: L.vt, state: copyState(L) };
      running = false;
      return;
    }
  }
}

function syncClock(now) {
  const realSeconds = Math.min(Math.max((now - lastNow) / 1000, 0), MAX_FRAME_S);
  lastNow = now;
  if (running) advance(realSeconds * MIN_PER_SEC);
}

function tick(now) {
  syncClock(now);
  render();
  requestAnimationFrame(tick);
}

// Applies a player action, snapping it to a nearby event (see file header).
function perform(mutator, startsTime) {
  if (finished) return;
  syncClock(performance.now());
  const sinceAnchor = L.vt - anchor.vt;
  const past = sinceAnchor <= SNAP ? sinceAnchor : Infinity;
  const r = runningTime();
  const ahead = r > 0 && r <= SNAP_AHEAD ? r : Infinity;
  if (past !== Infinity && past <= ahead) {
    L = copyState(anchor.state);
  } else if (ahead !== Infinity) {
    advance(ahead);
  }
  mutator();
  anchor = { vt: L.vt, state: copyState(L) };
  if (finished) running = false;
  else if (startsTime && runningTime() > 0) running = true;
  else if (runningTime() === 0) running = false;
  render();
}

// ---- game flow ----

function readSettings() {
  const a = Math.min(19, Math.max(1, parseInt(aInput.value, 10) || 7));
  const b = Math.min(20, Math.max(a + 1, parseInt(bInput.value, 10) || 11));
  const t = Math.min(60, Math.max(1, parseInt(tInput.value, 10) || 15));
  aInput.value = a;
  bInput.value = b;
  tInput.value = t;
  return { a, b, t };
}

function newGame() {
  const s = readSettings();
  caps = { a: s.a, b: s.b };
  target = s.t;
  L = { ta: 0, tb: 0, egg: 0, cooked: 0, flips: 0, vt: 0 };
  anchor = { vt: 0, state: copyState(L) };
  lastNow = performance.now();
  finished = false;
  running = false;
  logItems = [];
  renderedLogCount = -1;
  statusEl.textContent = "";
  statusEl.className = "";
  solutionEl.hidden = true;
  solutionEl.innerHTML = "";

  for (const which of ["a", "b"]) {
    const cap = caps[which];
    const g = glasses[which];
    g.box.querySelector(".glass-art").innerHTML = glassMarkup(cap);
    g.svg = g.box.querySelector("svg");
    g.label.textContent = `${cap}-minute glass`;
    g.flipBtn.setAttribute("aria-label", `Turn the ${cap}-minute glass over`);
  }
  for (const n of document.querySelectorAll(".goal-t")) n.textContent = target;
  document.title = `The Hourglass Puzzle: ${caps.a} & ${caps.b} → ${target}`;
  render();
}

function turnGlass(which) {
  if (which === "a") L.ta = caps.a - L.ta;
  else L.tb = caps.b - L.tb;
  L.flips++;
  log(`Turned the ${caps[which]}-minute glass over.`);
  spin(which);
}

function flip(which) {
  perform(() => turnGlass(which), true);
}

function continueTime() {
  if (finished || running || runningTime() === 0) return;
  lastNow = performance.now();
  running = true;
  render();
}

function toggleEgg() {
  perform(() => {
    if (L.egg === 0) {
      L.egg = 1;
      log("Put the egg in.");
      return;
    }
    L.egg = 2;
    log("Took the egg out.");
    finished = true;
    showResult();
  });
}

function showResult() {
  if (Math.abs(L.cooked - target) < WIN_TOLERANCE) {
    const best = solutionFor();
    let extra = "";
    if (best) {
      extra =
        L.flips <= best.flips
          ? " That's the fewest flips possible."
          : ` The fewest possible is ${best.flips} — can you match it?`;
    }
    statusEl.className = "win";
    statusEl.textContent = `Perfect! The egg boiled for exactly ${target} minutes, using ${L.flips} flips.${extra}`;
    return;
  }
  const whole = Math.abs(L.cooked - Math.round(L.cooked)) < WIN_TOLERANCE;
  statusEl.className = "lose";
  statusEl.textContent =
    `The egg boiled for ${fmt(L.cooked)} minutes, not ${target}. ` +
    (whole ? "Press Reset to try again." : "Try to act right when a glass runs out. Press Reset to try again.");
}

// ---- solver hint ----

const solutionCache = new Map();

function solutionFor() {
  const key = `${caps.a},${caps.b},${target}`;
  if (!solutionCache.has(key)) solutionCache.set(key, Core.solve(caps, target));
  return solutionCache.get(key);
}

function gcd(x, y) {
  return y === 0 ? x : gcd(y, x % y);
}

function showSolution() {
  const result = solutionFor();
  solutionEl.hidden = false;
  solutionEl.innerHTML = "";
  if (!result) {
    const g = gcd(caps.a, caps.b);
    const p = document.createElement("p");
    p.textContent =
      target % g !== 0
        ? `This one can't be done. Every moment a glass runs out is a multiple of ${g} minutes, so no whole number of minutes like ${target} can be measured.`
        : `No way to measure exactly ${target} minutes was found for these glasses.`;
    solutionEl.appendChild(p);
    return;
  }
  const ol = document.createElement("ol");
  for (const step of result.steps) {
    const li = document.createElement("li");
    li.textContent = Core.describe(step, caps);
    ol.appendChild(li);
  }
  const p = document.createElement("p");
  p.textContent = `One shortest solution: ${result.flips} flips, and ${result.elapsed} minutes from start to finish. (Starting a glass counts as a flip.)`;
  solutionEl.appendChild(p);
  solutionEl.appendChild(ol);
}

// ---- events ----

glasses.a.flipBtn.addEventListener("click", () => flip("a"));
glasses.b.flipBtn.addEventListener("click", () => flip("b"));
eggBtn.addEventListener("click", toggleEgg);
continueBtn.addEventListener("click", continueTime);
resetBtn.addEventListener("click", newGame);
solutionBtn.addEventListener("click", showSolution);
for (const input of [aInput, bInput, tInput]) input.addEventListener("change", newGame);
puzzleSelect.addEventListener("change", () => {
  const custom = puzzleSelect.value === "custom";
  customFields.hidden = !custom;
  if (!custom) {
    [aInput.value, bInput.value, tInput.value] = puzzleSelect.value.split(",");
  }
  newGame();
});

newGame();
requestAnimationFrame(tick);
