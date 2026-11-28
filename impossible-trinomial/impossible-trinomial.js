"use strict";

/*
 * The page for Impossible Trinomial: drawing and controls only. The fork's
 * geometry and the two scrollbars' ranges and arithmetic live in
 * impossible-trinomial-core.js, straight from the Java applet.
 *
 * The stage holds an SVG at the applet's own 600 x 300 canvas size. Six rails,
 * five oblique strokes and three oval ends are made once and then only moved;
 * a background-coloured band (the applet's DrawCover) is painted over them.
 * There is no move to make and nothing to win: the two sliders just let you
 * hide parts of one drawing and see how the reading changes.
 */

(function () {
  const Core = ImpossibleTrinomialCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const wRange = document.getElementById("wRange");
  const dRange = document.getElementById("dRange");
  const wValue = document.getElementById("wValue");
  const dValue = document.getElementById("dValue");
  const wLess = document.getElementById("wLess");
  const wMore = document.getElementById("wMore");
  const dLess = document.getElementById("dLess");
  const dMore = document.getElementById("dMore");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /** Shows the line under the picture. A demo has no win, loss or done state. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: the fork first, the applet's cover band over it. */
  const forkLayer = board.layer("fork");
  const coverLayer = board.layer("cover");

  const g0 = Core.geometry(state);
  const strokes = g0.strokes.map((s) => board.segment(s.a, s.b, "fork-line", forkLayer));
  const rails = g0.rails.map((r) => board.segment(r.from, r.to, "fork-line", forkLayer));
  const ovals = g0.ovals.map(() => board.el("ellipse", null, "fork-oval", forkLayer));
  const coverFill = board.el("rect", null, "cover-fill", coverLayer);
  const coverEdge = board.el("rect", null, "cover-edge", coverLayer);

  function render() {
    const g = Core.geometry(state);
    const band = Core.cover(state);

    g.strokes.forEach((s, i) => strokes[i].set(s.a, s.b));
    g.rails.forEach((r, i) => rails[i].set(r.from, r.to));
    g.ovals.forEach((o, i) => {
      ovals[i].setAttribute("cx", o.x + o.w / 2);
      ovals[i].setAttribute("cy", o.y + o.h / 2);
      ovals[i].setAttribute("rx", o.w / 2);
      ovals[i].setAttribute("ry", o.h / 2);
    });

    // DrawCover fills a band with the background colour, then outlines it.
    for (const node of [coverFill, coverEdge]) {
      node.setAttribute("x", band.x);
      node.setAttribute("y", band.y);
      node.setAttribute("width", band.width);
      node.setAttribute("height", band.height);
    }
    // A band slid past the right edge should not draw a stray edge there.
    const off = band.x >= state.width;
    coverFill.style.display = off ? "none" : "";
    coverEdge.style.display = off ? "none" : "";

    wValue.textContent = String(state.W);
    dValue.textContent = String(state.D);
    wRange.value = String(state.W);
    dRange.value = String(state.D);
    wLess.disabled = state.W <= Core.W_MIN;
    wMore.disabled = state.W >= Core.W_MAX;
    dLess.disabled = state.D <= Core.D_MIN;
    dMore.disabled = state.D >= Core.D_MAX;

    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function setW(value) {
    state = Core.withW(state, value);
    render();
  }

  function setD(value) {
    state = Core.withD(state, value);
    render();
  }

  wRange.addEventListener("input", () => setW(Number(wRange.value)));
  dRange.addEventListener("input", () => setD(Number(dRange.value)));
  wLess.addEventListener("click", () => setW(state.W - 1));
  wMore.addEventListener("click", () => setW(state.W + 1));
  dLess.addEventListener("click", () => setD(state.D - 1));
  dMore.addEventListener("click", () => setD(state.D + 1));
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours come from site.css tokens, so a theme flip only needs a redraw.
  board.onTheme(render);
  render();
})();
