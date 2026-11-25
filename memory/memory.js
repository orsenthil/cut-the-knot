"use strict";

/*
 * The page for Memory: drawing and input only. Twenty real buttons; a card's
 * face is built once per deal and shown or hidden with a class, so focus stays
 * where it is after a pair is judged. The rules are in memory-core.js.
 */

(function () {
  const Core = MemoryCore;
  const grid = document.getElementById("grid");
  const caption = document.getElementById("caption");
  const statusEl = document.getElementById("status");
  const modesEl = document.querySelector("fieldset.modes");
  const NS = "http://www.w3.org/2000/svg";
  const COLOURS = ["#e5624d", "#3fb27f", "#4a86e8", "#f0b247", "#c77dd6", "#41b6b6"];
  const JUDGE_DELAY = 1000; // the applet turns a wrong pair back at once; a moment is needed to see it

  let state = null, cards = [], timer = 0;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* ---- shapes, each centred in a 100 by 100 box */
  const poly = (pts) => "M" + pts.map((p) => p.map((v) => +v.toFixed(1)).join(" ")).join("L") + "Z";
  const regular = (n, r, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [50 + r * Math.cos(rot + (2 * Math.PI * i) / n), 50 + r * Math.sin(rot + (2 * Math.PI * i) / n)]);
  const star = (n, R, r) => Array.from({ length: 2 * n }, (_, i) => { const a = -Math.PI / 2 + (Math.PI * i) / n, q = i % 2 ? r : R; return [50 + q * Math.cos(a), 50 + q * Math.sin(a)]; });
  const SHAPES = [
    () => el("rect", { x: 22, y: 22, width: 56, height: 56 }),
    () => el("rect", { x: 10, y: 30, width: 80, height: 40 }),
    () => el("circle", { cx: 50, cy: 50, r: 30 }),
    () => el("ellipse", { cx: 50, cy: 50, rx: 40, ry: 24 }),
    () => el("path", { d: poly([[50, 12], [88, 50], [50, 88], [12, 50]]) }),
    () => el("path", { d: poly([[50, 14], [88, 84], [12, 84]]) }),
    () => el("path", { d: poly([[30, 28], [92, 28], [70, 72], [8, 72]]) }),
    () => el("path", { d: poly(star(5, 42, 17)) }),
    () => el("path", { d: poly(regular(6, 38, 0)) }),
    () => el("path", { d: poly(star(6, 42, 22)) }),
    () => el("path", { d: poly(regular(5, 40)) }),
    () => el("path", { d: poly(regular(8, 40, Math.PI / 8)) }),
  ];
  const SHAPE_NAMES = ["square", "rectangle", "circle", "oval", "diamond", "triangle", "parallelogram", "five-pointed star", "hexagon", "six-pointed star", "pentagon", "octagon"];
  const COLOUR_NAMES = ["red", "green", "blue", "amber", "purple", "teal"];

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /** A shape of this Id, drawn into box (x, y, w, h) of the svg. */
  function shapeAt(parent, id, x, y, w, h) {
    const g = el("g", { transform: `translate(${x} ${y}) scale(${w / 100} ${h / 100})` });
    const s = SHAPES[Core.shapeOf(id)]();
    s.setAttribute("fill", COLOURS[Core.colourOf(id)]); s.setAttribute("stroke", "#111"); s.setAttribute("stroke-width", 3);
    g.appendChild(s); parent.appendChild(g);
  }

  const pretty = (t) => t.replace("*", "×").replace("/", "÷").replace("-", "−");

  function faceFor(i) {
    const id = state.ids[i], which = state.which, face = document.createElement("span");
    face.className = "face";
    if (which === 3) { face.textContent = id; face.classList.add("txt"); face.style.fontSize = "1.6rem"; return face; }
    if (which >= 5) { face.classList.add("txt"); face.textContent = pretty(state.texts[i]); return face; }
    const svg = el("svg", { viewBox: which === 2 ? "0 0 100 100" : "0 0 120 80", "aria-hidden": "true" });
    if (which === 2) shapeAt(svg, id, 0, 0, 100, 100);
    else for (let k = 0; k < Core.countOf(id); k++) shapeAt(svg, id, (k % 3) * 40, Math.floor(k / 3) * 40, 40, 40);
    face.appendChild(svg);
    return face;
  }

  function describe(i) {
    const id = state.ids[i], which = state.which;
    if (which === 3) return `the number ${id}`;
    if (which >= 5) return `the sum ${pretty(state.texts[i])}`;
    const shape = SHAPE_NAMES[Core.shapeOf(id)], colour = COLOUR_NAMES[Core.colourOf(id)];
    if (which === 2) return `a ${colour} ${shape}`;
    return `${Core.countOf(id)} ${colour} ${shape}${Core.countOf(id) > 1 ? "s" : ""}`;
  }

  function buildMenu() {
    Core.MODES.forEach((m) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio"; input.name = "mode"; input.value = m.which;
      input.checked = m.which === Core.DEFAULT_WHICH;
      input.addEventListener("change", () => deal(m.which));
      label.append(input, " " + m.button);
      modesEl.appendChild(label);
    });
  }

  function deal(which) {
    clearTimeout(timer);
    state = Core.start({ which: which === undefined ? currentMode() : which });
    const m = Core.MODES[state.which];
    caption.textContent = m.caption;
    grid.textContent = ""; cards = [];
    state.ids.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card";
      const back = document.createElement("span"); back.className = "back"; back.textContent = "?"; back.setAttribute("aria-hidden", "true");
      b.append(back, faceFor(i));
      b.addEventListener("click", () => play(i));
      grid.appendChild(b); cards.push(b);
    });
    say("");
    render();
  }

  const currentMode = () => Number((document.querySelector('input[name="mode"]:checked') || {}).value);

  function render() {
    cards.forEach((b, i) => {
      const up = state.matched[i] || state.showing.includes(i);
      b.classList.toggle("up", up); b.classList.toggle("found", state.matched[i]);
      b.setAttribute("aria-label", up ? `Card ${i + 1}: ${describe(i)}${state.matched[i] ? ", matched" : ""}` : `Card ${i + 1}, face down`);
    });
    if (window.Track) window.Track.state({ which: state.which, ids: state.ids, matched: state.matched, showing: state.showing, turns: state.turns });
  }

  function play(i) {
    const next = Core.flip(state, i);
    if (!next) return;
    state = next; render();
    if (!Core.needsJudging(state)) return;
    const [a, b] = state.showing, ok = Core.equals(state.which, state.ids[a], state.ids[b]);
    say(ok ? "A match!" : "No match. They will turn back.");
    timer = setTimeout(() => {
      state = Core.judge(state); render();
      if (Core.result(state) === "win") say(`All the pairs are found, in ${state.turns} turns.`, "win");
      else say(ok ? "A match! Keep going." : `${state.turns} turn${state.turns === 1 ? "" : "s"} so far.`);
    }, ok ? 400 : JUDGE_DELAY);
  }

  document.getElementById("resetBtn").addEventListener("click", () => deal());
  buildMenu();
  deal(Core.DEFAULT_WHICH);
})();
