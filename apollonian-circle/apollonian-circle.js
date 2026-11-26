"use strict";

/*
 * ApollonianCircle — the drawing and input, with all the geometry in
 * apollonian-circle-core.js.  A, B, R and P are draggable; the ratio slider
 * also moves P.  The orange circle through P is the locus AP/BP = r, drawn
 * from the internal and external division points D and E; the dashed circle
 * is its image under inversion in the circle centred at A through R.
 */

(function () {
  const Core = ApollonianCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const ratioEl = document.getElementById("ratio");
  const ratioOut = document.getElementById("ratioOut");
  const nEl = document.getElementById("n");
  const namesEl = document.getElementById("names");
  const hintEl = document.getElementById("hint");
  const extraEl = document.getElementById("extra");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({
    ratio: Number(ratioEl.value), n: Number(nEl.value),
    names: namesEl.checked, hint: hintEl.checked, extra: extraEl.checked,
  });

  /* Back to front: construction guides, the locus, the inverted family,
   * small dots and names, then the handles that keep keyboard focus. */
  const guides = board.layer("guides");
  const locusLayer = board.layer("locus");
  const imageLayer = board.layer("image");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const ab = board.segment(state.A, state.B, "base", guides);
  const radius = board.segment(state.A, state.R, "radius", guides);
  const invCircle = board.circle(state.A, 1, "inv-circle", guides);
  const legD = board.segment(state.P, state.A, "bisector-leg", guides);
  const legE = board.segment(state.P, state.B, "bisector-leg", guides);
  const locusCircle = board.circle(state.A, 1, "locus", locusLayer);
  const bisector = board.line(state.A, state.B, "bisector", locusLayer);
  const imageCircle = board.circle(state.A, 1, "image", imageLayer);
  const family = [];
  for (let i = 0; i < Core.N_MAX; i++) family.push(board.circle(state.A, 1, "family", imageLayer));

  const dotD = board.point(state.A, "cut-dot", 4, dots);
  const dotE = board.point(state.B, "cut-dot", 4, dots);
  const dotBp = board.point(state.A, "image-dot", 3.5, dots);
  const dotPp = board.point(state.P, "image-dot", 3.5, dots);
  const labels = {};
  for (const key of ["A", "B", "P", "R", "D", "E", "Bp", "Pp"]) {
    labels[key] = board.label(state.A, key === "Bp" ? "B'" : key === "Pp" ? "P'" : key,
      "point-label", key === "E" || key === "Bp" ? 7 : -13, key === "R" ? 18 : -10, names);
  }

  const handleOpts = {
    r: 9, step: 4, shift: 12, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of ["A", "B", "R", "P"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOpts, {
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
    handles.R.set(state.R);
    handles.P.set(state.P);

    ab.set(state.A, state.B);
    radius.set(state.A, state.R);
    invCircle.set(g.inv.c, g.inv.r);

    if (g.circle) {
      locusCircle.set(g.circle.c, g.circle.r);
      locusCircle.show(true);
      bisector.show(false);
      dotD.set(g.D);
      dotE.set(g.E);
      dotD.show(state.options.names || state.options.hint);
      dotE.show(state.options.names || state.options.hint);
      legD.set(state.P, g.D);
      legE.set(state.P, g.E);
      legD.show(state.options.hint);
      legE.show(state.options.hint);
    } else {
      locusCircle.show(false);
      const n = g.line.n, m = g.line.m;
      const len = Math.hypot(n.x, n.y) || 1;
      const u = { x: -n.y / len * 600, y: n.x / len * 600 };
      bisector.set(Core.sub(m, u), Core.add(m, u));
      bisector.show(true);
      dotD.show(false);
      dotE.show(false);
      legD.show(false);
      legE.show(false);
    }

    const hasImage = !!g.imageCircle;
    imageCircle.set(hasImage ? g.imageCircle.c : state.A, hasImage ? g.imageCircle.r : 1);
    imageCircle.show(state.options.extra && hasImage);
    dotBp.set(g.Bp);
    dotPp.set(g.Pp);
    dotBp.show(state.options.extra && hasImage);
    dotPp.show(state.options.extra && hasImage);
    const step = Math.hypot(g.Bp.x - g.Pp.x, g.Bp.y - g.Pp.y) / state.options.n;
    for (let i = 0; i < family.length; i++) {
      const on = state.options.extra && hasImage && i < state.options.n && step > 1;
      family[i].set(g.Bp, (i + 1) * step);
      family[i].show(on);
    }

    const shown = (key, on) => labels[key].show(on);
    shown("A", state.options.names); shown("B", state.options.names);
    shown("P", state.options.names); shown("R", state.options.names);
    shown("D", !!g.E && (state.options.names || state.options.hint));
    shown("E", !!g.E && (state.options.names || state.options.hint));
    labels.D.set(g.D || state.A); labels.E.set(g.E || state.B);
    shown("Bp", state.options.extra && hasImage && state.options.names);
    shown("Pp", state.options.extra && hasImage && state.options.names);
    labels.Bp.set(g.Bp); labels.Pp.set(g.Pp);

    ratioOut.textContent = state.options.ratio.toFixed(3);
    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function setRatio() {
    state = Core.setOption(state, "ratio", Number(ratioEl.value));
    ratioEl.value = String(state.options.ratio);
    render();
  }

  ratioEl.addEventListener("input", setRatio);
  nEl.addEventListener("input", () => {
    state = Core.setOption(state, "n", Number(nEl.value));
    nEl.value = String(state.options.n);
    render();
  });
  for (const [el, key] of [[namesEl, "names"], [hintEl, "hint"], [extraEl, "extra"]]) {
    el.addEventListener("change", () => {
      state = Core.setOption(state, key, el.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  // SVG colours come from CSS classes, but keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
