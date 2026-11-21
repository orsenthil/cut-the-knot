"use strict";

/*
 * The page for Curry's Paradox: drawing and input only; the rules are in
 * curry-paradox-core.js. One SVG holds two boxes, one above the other, each
 * showing the big "triangle" with its grid. The pieces start in the upper box;
 * drag them (or focus one and use the arrow keys, Enter to send it home) into
 * the lower box. A piece within 20 applet pixels of its place snaps into it. When
 * all are in, the leftover rectangles are labelled and their areas compared.
 * "Animate" slides the pieces home one after the other, as the applet's button.
 */

(function () {
  const Core = CurryParadoxCore;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const twoBtn = document.getElementById("two");
  const fourBtn = document.getElementById("four");
  const innerBtn = document.getElementById("inner");
  const perimBtn = document.getElementById("perim");
  const animateBtn = document.getElementById("animateBtn");
  const resetBtn = document.getElementById("resetBtn");
  const factsEl = document.getElementById("facts");
  const COLOURS = { orange: "#e08a2e", green: "#3aa675", pink: "#d65d9e", blue: "#4c9be0" };

  let state = Core.start();
  let drag = null;
  let animating = false;
  let focusPiece = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const pts = (verts) => verts.map(([x, y]) => `${x},${y}`).join(" ");

  function draw() {
    const g = Core.geometry(state.fn, state.four, state.inner);
    const m = 2; // margin in cells
    const W = g.width + 2 * m, H = 2 * g.height + 2 + 2 * m; // two boxes with a gap of 2 cells
    svg.setAttribute("viewBox", `${-m} ${-m} ${W} ${H}`);
    svg.textContent = "";
    const hair = Math.max(0.02, W / 700); // a hairline in cell units
    // The two boxes with their grids.
    for (const oy of [0, g.gap]) {
      svg.appendChild(el("rect", { x: 0, y: oy, width: g.width, height: g.height, class: "box" }));
      if (g.width <= 60) {
        const grid = el("path", { class: "grid", "stroke-width": hair, d: Array.from({ length: g.width + 1 }, (_, i) => `M${i} ${oy}V${oy + g.height}`).join("") + Array.from({ length: g.height + 1 }, (_, j) => `M0 ${oy + j}H${g.width}`).join("") });
        svg.appendChild(grid);
      }
      // The big triangle's own hypotenuse, from the lower left to the upper right corner.
      svg.appendChild(el("line", { x1: 0, y1: oy + g.height, x2: g.width, y2: oy, class: "hyp", "stroke-width": hair * 2.2 }));
    }
    // When every piece is home, show the leftover rectangle of each box with its size.
    const allIn = Core.allIn(state);
    if (!state.four) {
      const a = g.leftRect, b = g.rightRect;
      for (const [r, label] of [[a, `${g.lengths.S4} × ${g.lengths.S5} = ${g.lengths.S4 * g.lengths.S5}`], [b, `${g.lengths.S3} × ${g.lengths.S6} = ${g.lengths.S3 * g.lengths.S6}`]]) {
        svg.appendChild(el("rect", { x: r.x, y: r.y, width: r.w, height: r.h, class: "leftover" + (allIn ? " shown" : "") }));
        if (allIn || r === a) {
          const t = el("text", { x: r.x + r.w / 2, y: r.y + r.h / 2, class: "rlabel", "font-size": Math.min(r.h * 0.6, r.w / (label.length * 0.62)) });
          t.textContent = label;
          svg.appendChild(t);
        }
      }
    }
    // The pieces, the one most recently moved on top.
    state.offsets.forEach((o, i) => {
      const p = g.pieces[i];
      const inPlace = Core.inPlace(state, i);
      const v = Core.vertices(state, i);
      const grp = el("g", { class: "piece" + (inPlace ? " home" : ""), tabindex: 0, role: "button", "data-piece": i, "aria-label": `${p.name}, ${inPlace ? "in place" : "not in place yet"}. Drag it, or use the arrow keys; Enter sends it to its place.` });
      grp.appendChild(el("polygon", { points: pts(v), fill: COLOURS[p.colour], class: "poly", "stroke-width": hair * 3 }));
      attach(grp, i);
      svg.appendChild(grp);
    });
    if (focusPiece !== null) {
      const f = svg.querySelector(`[data-piece="${focusPiece}"]`);
      if (f) f.focus();
    }
  }

  function updateText() {
    const f = Core.facts(state.fn);
    factsEl.textContent = `n = ${f.n}: legs ${f.legs[0]} and ${f.legs[1]}; the rectangles are ${f.rectangles[0].w} × ${f.rectangles[0].h} = ${f.rectangles[0].area} and ${f.rectangles[1].w} × ${f.rectangles[1].h} = ${f.rectangles[1].area}, a difference of ${f.areaDifference > 0 ? "+" : ""}${f.areaDifference}.`;
    nIn.value = String(state.fn + 1);
    twoBtn.checked = !state.four;
    fourBtn.checked = state.four;
    fourBtn.disabled = state.fn !== Core.START_FN;
    innerBtn.checked = state.inner;
    perimBtn.checked = !state.inner;
    innerBtn.disabled = perimBtn.disabled = !state.four;
  }

  function render() {
    draw();
    updateText();
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    const kind = Core.result(state);
    say(kind ? finishedText() : note || "", kind);
    return true;
  }

  function finishedText() {
    const f = Core.facts(state.fn);
    return state.four
      ? "All four pieces are in place. The rectangle of 15 squares has become 16 squares with one square missing: where did the extra area come from?"
      : `Both triangles are swapped. The leftover rectangle was ${f.rectangles[0].area} squares and is now ${f.rectangles[1].area}. How can the same pieces cover one square ${f.areaDifference > 0 ? "more" : "less"}?`;
  }

  /** Cell coordinates of a pointer position. */
  function toCells(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  function attach(grp, i) {
    grp.addEventListener("pointerdown", (e) => {
      if (animating) return;
      const c = toCells(e);
      drag = { i, grabX: c.x - state.offsets[i].dx, grabY: c.y - state.offsets[i].dy };
      // A snapped piece is drawn home but sits where it was dragged: grab it from there.
      focusPiece = i;
      grp.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grp.addEventListener("pointermove", (e) => {
      if (!drag || drag.i !== i) return;
      const c = toCells(e);
      const next = Core.move(state, { type: "drag", piece: i, dx: c.x - drag.grabX, dy: c.y - drag.grabY });
      if (!next) return;
      state = next;
      const g = svg.querySelector(`[data-piece="${i}"] polygon`);
      if (g) g.setAttribute("points", pts(Core.vertices(state, i)));
    });
    const stop = () => {
      if (!drag) return;
      drag = null;
      render();
      const kind = Core.result(state);
      say(kind ? finishedText() : Core.inPlace(state, i) ? "That piece snapped into place." : "", kind);
    };
    grp.addEventListener("pointerup", stop);
    grp.addEventListener("pointercancel", stop);
    grp.addEventListener("keydown", (e) => {
      if (animating) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        focusPiece = i;
        apply({ type: "place", piece: i }, "That piece is in place.");
        return;
      }
      const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[e.key.toLowerCase()];
      if (!d) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.25 : 1;
      focusPiece = i;
      const o = state.offsets[i];
      apply({ type: "drag", piece: i, dx: o.dx + d[0] * step, dy: o.dy + d[1] * step }, Core.inPlace(state, i) ? "" : "");
    });
  }

  /* Animate: each piece in turn glides from where it is to its place, as the applet's thread does. */
  function animate() {
    if (animating) return;
    animating = true;
    animateBtn.disabled = true;
    const order = state.offsets.map((_, i) => i);
    const steps = 50;
    const run = (k, s) => {
      if (k >= order.length) {
        animating = false;
        animateBtn.disabled = false;
        render();
        say(Core.result(state) ? finishedText() : "", Core.result(state));
        return;
      }
      const i = order[k];
      const from = { ...state.offsets[i] }, to = Core.finalOffset(state, i);
      const tick = () => {
        s += 1;
        const t = s / steps;
        state = Core.move(state, { type: "drag", piece: i, dx: from.dx + (to.dx - from.dx) * t, dy: from.dy + (to.dy - from.dy) * t });
        draw();
        if (s < steps) requestAnimationFrame(tick); else run(k + 1, 0);
      };
      requestAnimationFrame(tick);
    };
    run(0, 0);
  }

  animateBtn.addEventListener("click", animate);
  resetBtn.addEventListener("click", () => { if (animating) return; focusPiece = null; state = Core.move(state, { type: "reset" }); render(); say("Back to the start."); });
  nIn.addEventListener("change", () => {
    if (animating) return;
    const v = Math.trunc(Number(nIn.value)) - 1;
    focusPiece = null;
    if (!apply({ type: "fn", value: v }, "")) say("n must be a number from 4 to 11.");
    say(`n = ${state.fn + 1}`);
  });
  twoBtn.addEventListener("change", () => { focusPiece = null; apply({ type: "pieces", value: 2 }, "Two pieces."); });
  fourBtn.addEventListener("change", () => { focusPiece = null; if (!apply({ type: "pieces", value: 4 }, "Four pieces: the rectangle is cut in two.")) { say("Four pieces are only available for n = 6."); updateText(); } });
  innerBtn.addEventListener("change", () => { focusPiece = null; apply({ type: "hole", value: "inside" }, "The hole will be inside."); });
  perimBtn.addEventListener("change", () => { focusPiece = null; apply({ type: "hole", value: "perimeter" }, "The hole will be on the perimeter."); });

  render();
})();
