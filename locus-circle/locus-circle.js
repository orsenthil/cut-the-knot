"use strict";

/*
 * The page for LocusCircle: drawing and input only; all the geometry is in
 * locus-circle-core.js.  The SVG holds the segment AB, the pink parallels of
 * the construction, the light-gray locus circle (or the exact perpendicular
 * bisector when the two spinner numbers agree), and three draggable points.
 * M and N are drawn only with Names; the parallels and the circle with Hint
 * and Extra construction, as in the applet.
 */

(function () {
  const Core = LocusCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nbEl = document.getElementById("nb");
  const ncEl = document.getElementById("nc");
  const namesEl = document.getElementById("names");
  const hintEl = document.getElementById("hint");
  const extraEl = document.getElementById("extra");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({
    nb: Number(nbEl.value), nc: Number(ncEl.value),
    names: namesEl.checked, hint: hintEl.checked, extra: extraEl.checked,
  });

  /* Back to front: guides, locus, dots, labels, then the focusable handles. */
  const guides = board.layer("guides");
  const locusLayer = board.layer("locus");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const ab = board.segment(state.A, state.B, "base", guides);
  const parallels = [];
  for (let i = 0; i < 45; i++) parallels.push(board.segment(state.A, state.B, "parallel", guides));
  const locusCircle = board.circle(state.A, 1, "locus", locusLayer);
  const bisector = board.line(state.A, state.B, "bisector", locusLayer);
  const dotM = board.point(state.A, "cut-dot", 4, dots);
  const dotN = board.point(state.B, "cut-dot", 4, dots);
  const labels = {};
  for (const key of ["A", "B", "P", "M", "N"]) {
    labels[key] = board.label(state.A, key, "point-label", key === "N" ? 7 : -13,
      key === "P" ? -10 : 20, names);
  }

  const opts = {
    r: 9, step: 4, shift: 12, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of ["A", "B", "P"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, opts, {
      label: `Point ${key}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    }));
  }

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.P.set(state.P);
    ab.set(state.A, state.B);

    if (!g) {
      locusCircle.show(false);
      bisector.show(false);
      dotM.show(false);
      dotN.show(false);
    } else if (g.circle) {
      locusCircle.set(g.circle.c, g.circle.r);
      locusCircle.show(state.options.extra);
      bisector.show(false);
      dotM.set(g.M);
      dotN.set(g.N || state.B);
      const showDots = state.options.names || state.options.hint;
      dotM.show(showDots);
      dotN.show(showDots && !!g.N);
    } else {
      locusCircle.show(false);
      const n = g.line.n;
      const len = Math.hypot(n.x, n.y) || 1;
      const u = { x: -n.y / len * 600, y: n.x / len * 600 };
      bisector.set(Core.sub(g.line.m, u), Core.add(g.line.m, u));
      bisector.show(true);
      dotM.set(g.M);
      dotM.show(state.options.names);
      dotN.show(false);
    }

    const segs = g ? Core.hintSegments(state) : [];
    for (let i = 0; i < parallels.length; i++) {
      const seg = segs[i];
      if (seg) parallels[i].set(seg.from, seg.to);
      parallels[i].show(!!seg && state.options.hint);
    }

    labels.A.set(state.A); labels.B.set(state.B); labels.P.set(state.P);
    labels.A.show(state.options.names);
    labels.B.show(state.options.names);
    labels.P.show(state.options.names);
    labels.M.set(g ? g.M : state.A);
    labels.N.set(g && g.N ? g.N : state.B);
    labels.M.show(!!g && state.options.names);
    labels.N.show(!!g && !!g.N && state.options.names);

    nbEl.value = String(state.options.nb);
    ncEl.value = String(state.options.nc);
    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function setCount(name, el) {
    state = Core.setOption(state, name, Number(el.value));
    render();
  }

  nbEl.addEventListener("input", () => setCount("nb", nbEl));
  ncEl.addEventListener("input", () => setCount("nc", ncEl));
  for (const [el, key] of [[namesEl, "names"], [hintEl, "hint"], [extraEl, "extra"]]) {
    el.addEventListener("change", () => {
      state = Core.setOption(state, key, el.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  // SVG colours come from CSS classes; still redraw when the theme flips.
  board.onTheme(render);
  render();
})();
