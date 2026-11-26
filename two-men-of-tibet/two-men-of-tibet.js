"use strict";

/*
 * The page for The Two Men of Tibet: drawing, input and animation only; the
 * walk is found in two-men-of-tibet-core.js. One SVG shows the range as a
 * broken line; inner corners are dragged up and down (or moved with the
 * arrow keys). "Start journey" walks the white man from the left end and
 * the black man from the right end, always at one height, until they have
 * swapped places. "Show levels" draws the level lines of the proof.
 */

(function () {
  const Core = TwoMenOfTibetCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const goBtn = document.getElementById("goBtn");
  const delayIn = document.getElementById("delayIn");
  const levelsBox = document.getElementById("levelsBox");
  const NS = "http://www.w3.org/2000/svg";
  const L = 30, R = 370, BASE = 250, TOP = 30;

  let state = Core.start({ seed: Math.floor(Math.random() * 1e9) });
  let walk = null; // { path, k, t, timer }
  let drag = null, men = null, finished = null;

  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, typeof attrs[k] === "number" ? attrs[k].toFixed(2) : attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const X = (x) => L + (x * (R - L)) / (state.heights.length - 1);
  const Y = (h) => BASE - h * (BASE - TOP);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    svg.textContent = "";
    const H = state.heights;
    svg.appendChild(el("line", { x1: L - 20, y1: BASE, x2: R + 20, y2: BASE }, "ground"));
    if (levelsBox.checked) {
      for (const h of [...new Set(H)]) svg.appendChild(el("line", { x1: L - 10, y1: Y(h), x2: R + 10, y2: Y(h) }, "level"));
      for (const p of Core.named(state)) if (p.corner === null) svg.appendChild(el("circle", { cx: X(p.x), cy: Y(p.h), r: 3.5 }, "named"));
    }
    const pts = H.map((h, i) => `${X(i).toFixed(1)},${Y(h).toFixed(1)}`);
    svg.appendChild(el("polygon", { points: `${X(0)},${BASE} ${pts.join(" ")} ${X(H.length - 1)},${BASE}` }, "rock"));
    svg.appendChild(el("polyline", { points: pts.join(" ") }, "ridge"));
    H.forEach((h, i) => {
      const inner = i > 0 && i < H.length - 1;
      const c = el("circle", { cx: X(i), cy: Y(h), r: inner ? 9 : 5 }, inner ? "handle" : "end");
      if (inner) {
        c.setAttribute("tabindex", "0"); c.setAttribute("role", "slider");
        c.setAttribute("aria-label", `Peak ${i}: drag it up or down, or use the arrow keys`);
        c.setAttribute("aria-valuenow", String(Math.round(h * 100)));
        c.dataset.i = String(i);
      }
      svg.appendChild(c);
    });
    if (men) {
      svg.appendChild(el("circle", { cx: X(men.white.x), cy: Y(men.white.h) - 9, r: 8 }, "man white"));
      svg.appendChild(el("circle", { cx: X(men.black.x), cy: Y(men.black.h) - 9, r: 8 }, "man black"));
    }
    if (window.Track) window.Track.state({ heights: H, walking: !!walk, step: walk ? walk.k : null });
  }

  function stopWalk() {
    if (walk) clearTimeout(walk.timer);
    walk = null;
    goBtn.textContent = "Start journey";
  }

  function frame() {
    const { path } = walk;
    const a = path[walk.k], b = path[walk.k + 1];
    const dh = Math.abs(b.white.h - a.white.h);
    walk.t += 1 / Math.max(2, Math.round(dh * 120));
    if (walk.t >= 1) { walk.k++; walk.t = 0; }
    if (walk.k >= path.length - 1) {
      men = { white: path[path.length - 1].white, black: path[path.length - 1].black };
      const tw = Core.turns(path, "white"), tb = Core.turns(path, "black");
      finished = `They have swapped places in ${path.length - 1} steps. The white man turned back ${tw} time${tw === 1 ? "" : "s"}, the black man ${tb} time${tb === 1 ? "" : "s"}.`;
      stopWalk(); render(); say(finished, "done");
      return;
    }
    const p = path[walk.k], q = path[walk.k + 1], t = walk.t;
    const mix = (u, v) => ({ x: u.x + t * (v.x - u.x), h: u.h + t * (v.h - u.h) });
    men = { white: mix(p.white, q.white), black: mix(p.black, q.black) };
    render();
    say(`Step ${walk.k + 1} of ${path.length - 1}: both men at height ${Math.round(men.white.h * 100)}.`);
    walk.timer = setTimeout(frame, Math.max(8, Number(delayIn.value) || 0));
  }

  goBtn.addEventListener("click", () => {
    if (walk) { stopWalk(); say("Stopped. Start journey to walk again from the ends."); return; }
    if (Core.plateau(state)) { say("Please remove the plateau first: two neighbouring corners are at the same height."); return; }
    const path = Core.journey(state);
    if (!path) return;
    walk = { path, k: 0, t: 0, timer: null };
    goBtn.textContent = "Stop";
    frame();
  });

  function moveCorner(i, h) {
    const s = Core.setHeight(state, i, h);
    if (!s) return;
    stopWalk();
    state = s; men = null;
    render();
    say(Core.plateau(state) ? "Two neighbouring corners are at the same height: a plateau." : "Press Start journey to send the two men walking.");
  }
  const toSvg = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  svg.addEventListener("pointerdown", (e) => {
    if (!e.target.classList.contains("handle")) return;
    e.preventDefault();
    drag = Number(e.target.dataset.i);
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => { if (drag !== null) moveCorner(drag, (BASE - toSvg(e).y) / (BASE - TOP)); });
  const end = () => { drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const i = e.target.dataset && e.target.dataset.i;
    const d = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[e.key];
    if (!i || !d) return;
    e.preventDefault();
    moveCorner(Number(i), state.heights[Number(i)] + d);
    svg.querySelector(`.handle[data-i="${i}"]`).focus();
  });
  levelsBox.addEventListener("change", render);
  document.getElementById("newBtn").addEventListener("click", () => {
    stopWalk(); men = null;
    state = Core.start({ seed: Math.floor(Math.random() * 1e9) });
    render(); say("A new range. Press Start journey.");
  });

  render();
  say("Drag the peaks up or down, then press Start journey.");
})();
