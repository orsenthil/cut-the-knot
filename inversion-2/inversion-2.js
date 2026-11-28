"use strict";

/*
 * Inversion2 — the drawing and input for Bogomolny's negative-power inversion.
 *
 * The stage holds the circle t (centre O, through R), its diameter CC2, the
 * bold circle w through C, C2 and A, and the point A' opposite A across O.  O, R, C
 * and A are draggable, focusable handles; C is kept on t by the core.  All of
 * the geometry lives in inversion-2-core.js; this file only draws it and reads
 * the controls.  A picture has no win or loss, so "done" means explored.
 */

(function () {
  const Core = Inversion2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesEl = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({ names: namesEl.checked });

  /* Back to front: guides, the circle w, the image dot, names, then the
   * handles, which are built last so keyboard focus survives a redraw. */
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const tCircle = board.circle(state.O, Core.UNIT, "circle-t", guides);
  const diameter = board.segment(state.C, state.O, "diameter", guides);
  const radial = board.line(state.O, state.A, "radial", guides);
  const wCircle = board.circle(state.O, 1, "circle-w", circles);
  const imageDot = board.point(state.O, "image-dot", 5, dots);

  const labels = {};
  for (const key of ["O", "R", "C", "A", "Aprime"]) {
    labels[key] = board.label(state.O, key === "Aprime" ? "A'" : key, "point-label", 7, -8, names);
  }

  const handleOpts = {
    r: 9, step: 4, shift: 12, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of ["O", "R", "C", "A"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOpts, {
      label: `Point ${key}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
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
    for (const key of ["O", "R", "C", "A"]) handles[key].set(state[key]);

    tCircle.set(g.t.c, g.t.r);
    diameter.set(g.C2, state.C);
    radial.show(!!g.Aprime);
    wCircle.show(!!g.w);
    imageDot.show(!!g.Aprime);
    if (g.Aprime) {
      radial.set(g.Aprime, state.A);
      imageDot.set(g.Aprime);
    }
    if (g.w) wCircle.set(g.w.c, g.w.r);

    labels.O.set(state.O);
    labels.R.set(state.R);
    labels.C.set(state.C);
    labels.A.set(state.A);
    labels.Aprime.set(g.Aprime || state.O);
    for (const key of ["O", "R", "C", "A", "Aprime"]) {
      labels[key].show(state.options.names && (key !== "Aprime" || !!g.Aprime));
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  namesEl.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesEl.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesEl.checked = state.options.names;
    render();
  });

  // SVG colours come from the page's CSS classes; keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
