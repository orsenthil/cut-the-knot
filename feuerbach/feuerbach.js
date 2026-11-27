"use strict";

/*
 * Browser UI for Feuerbach. All the geometry is in the DOM-free
 * feuerbach-core.js; this file only draws it and takes input.
 *
 * Drag A, B or C, or focus a corner and use the arrow keys. The three
 * checkboxes are the applet's "Show medians / altitudes / circles" panel;
 * the fourth exposes its ShowNames page parameter. Ticking circles draws the
 * incircle, the three excircles, the nine-point circle and the four dots
 * where they touch, exactly as the applet's Draw() method does.
 */

(() => {
  const C = FeuerbachCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const toggles = {
    medians: document.getElementById("mediansCheck"),
    altitudes: document.getElementById("altitudesCheck"),
    circles: document.getElementById("circlesCheck"),
    names: document.getElementById("namesCheck"),
  };

  const board = Geom.board("board");
  const guides = board.layer("guides");
  const circlesLayer = board.layer("circles");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start();

  /** Write the status line; "win", "lose" and "done" are the record's signals. */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  /* Each SVG object is made once and moved with .set(), so focus on a handle
     survives every redraw. */
  const triangle = board.polygon([state.A, state.B, state.C], "tri", guides);
  const medianShapes = Array.from({ length: 3 }, () =>
    board.segment(state.A, state.B, "median-guide", guides));
  const altitudeShapes = Array.from({ length: 9 }, () =>
    board.segment(state.A, state.B, "altitude-guide", guides));
  const incircle = board.circle(state.A, 1, "in-circle", circlesLayer);
  const excircles = [0, 1, 2].map(() => board.circle(state.A, 1, "ex-circle", circlesLayer));
  const nineCircle = board.circle(state.A, 1, "nine-circle", circlesLayer);
  const touchDots = [0, 1, 2, 3].map(() => board.point(state.A, "touch-dot", 4, dots));
  const centreDots = [0, 1, 2, 3, 4].map((i) =>
    board.point(state.A, i === 0 ? "nine-dot" : i === 1 ? "in-dot" : "ex-dot", 3.5, dots));

  const shown = { A: "A", B: "B", C: "C", I: "I", N: "N", F: "F" };
  const offsets = { A: [-16, -12], B: [-16, 19], C: [8, -10], I: [7, -8], N: [7, 17], F: [7, -8] };
  const text = Object.fromEntries(Object.keys(shown).map((n) => [n,
    board.label(state.A, shown[n], "pt-label", offsets[n][0], offsets[n][1], labels)]));

  function place(name, p) {
    text[name].show(Boolean(p));
    if (p) text[name].set(p, shown[name], offsets[name][0], offsets[name][1]);
  }

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p, name) => `at ${p.x.toFixed(0)}, ${p.y.toFixed(0)} in the drawing`;
  const onMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handles = {
    A: board.handle("A", state.A, { r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: "Corner A. Drag it, or focus it and use the arrow keys to move it." }),
    B: board.handle("B", state.B, { r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: "Corner B. Drag it, or focus it and use the arrow keys to move it." }),
    C: board.handle("C", state.C, { r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: "Corner C. Drag it, or focus it and use the arrow keys to move it." }),
  };

  function render() {
    const g = C.geometry(state);
    const o = state.options;
    for (const name of ["A", "B", "C"]) {
      handles[name].set(state[name]);
      place(name, o.names ? state[name] : null);
    }
    for (const name of ["I", "N", "F"]) place(name, null);

    if (!g.valid) {
      triangle.show(false);
      for (const s of medianShapes.concat(altitudeShapes)) s.show(false);
      for (const s of [incircle, nineCircle].concat(excircles)) s.show(false);
      for (const s of touchDots.concat(centreDots)) s.show(false);
      say("Move A, B and C so they make a triangle; the circles cannot be drawn from a straight line.");
    } else {
      triangle.show(true).set([g.A, g.B, g.C]);
      g.medians.forEach((pair, i) => medianShapes[i].set(pair[0], pair[1]).show(o.medians));
      g.altitudes.forEach((pair, i) => altitudeShapes[i].set(pair[0], pair[1]).show(o.altitudes));

      incircle.set(g.incircle.center, g.incircle.radius).show(o.circles);
      g.excircles.forEach((c, i) => excircles[i].set(c.center, c.radius).show(o.circles));
      nineCircle.set(g.nine.center, g.nine.radius).show(o.circles);
      g.touches.forEach((p, i) => touchDots[i].set(p).show(o.circles));
      [g.N, g.I, ...g.excenters].forEach((p, i) => centreDots[i].set(p).show(o.circles));

      if (o.names && o.circles) {
        place("N", g.N);
        place("I", g.I);
        place("F", g.touches[3]);
      }

      if (!o.circles) {
        say("Tick circles to see the nine-point circle, the incircle, the three excircles and their four touching points.");
      } else if (C.coincidentIncircle(g)) {
        say(`Equilateral: the nine-point circle and incircle are the same circle (radius ${g.inradius.toFixed(2)}). There is no single Feuerbach point; the three excircles still touch.`);
      } else {
        const gap = C.centreGapErrors(g);
        say(`The nine-point circle (radius ${g.nineRadius.toFixed(2)}) touches the incircle (radius ${g.inradius.toFixed(2)}) at F: centre gap ${C.dist(g.N, g.I).toFixed(2)} = ${g.nineRadius.toFixed(2)} − ${g.inradius.toFixed(2)}. The three excircles touch it too (largest centre-gap error ${Math.max(...gap.slice(1)).toExponential(1)}).`);
      }
    }

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  for (const name in toggles) {
    const box = toggles[name];
    box.checked = state.options[name];
    box.addEventListener("change", () => {
      state = C.setOption(state, name, box.checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = C.start();
    for (const name in toggles) toggles[name].checked = state.options[name];
    render();
  });

  board.onTheme(render);
  render();
})();
