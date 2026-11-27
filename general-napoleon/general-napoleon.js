"use strict";

/*
 * General Napoleon — the drawing and input only.  All the geometry, the
 * slider ranges and the page's claim live in general-napoleon-core.js.
 *
 * The stage is one SVG: triangle ABC in the middle, three pairs of points on
 * its sides, and three isosceles triangles built on KL, PQ and MN.  When the
 * two sliders add to 1 (the applet's 0.99..1.01 band), the three lines from a
 * vertex to the opposite apex are drawn in green with their meeting dot;
 * otherwise only the apex-to-vertex segments are drawn, exactly as the applet
 * switches its DrawTorricelli method.  Every shape is created once and only
 * updated on a redraw, so a dragged point keeps keyboard focus.
 */

(function () {
  const Core = GeneralNapoleonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const controls = {
    up: document.getElementById("up"),
    down: document.getElementById("down"),
    angle: document.getElementById("angle"),
    names: document.getElementById("names"),
  };
  const outputs = {
    up: document.getElementById("upOut"),
    down: document.getElementById("downOut"),
    angle: document.getElementById("angleOut"),
  };
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Back to front: the small triangles, the big one, lines, then dots. */
  const guides = board.layer("guides");
  const spans = board.layer("spans");
  const lines = board.layer("lines");
  const dots = board.layer("dots");
  const texts = board.layer("texts");
  const top = board.layer("handles");

  const triangle = board.polygon([state.A, state.B, state.C], "abc", guides);
  const bases = [0, 1, 2].map(() => board.segment(state.A, state.B, "base", guides));
  const smallSides = [0, 1, 2].map(() => [
    board.segment(state.A, state.B, "small-side", guides),
    board.segment(state.A, state.B, "small-side", guides),
  ]);
  const cevians = [0, 1, 2].map(() => board.line(state.A, state.B, "cevian", lines));
  const plainLines = [0, 1, 2].map(() => board.segment(state.A, state.B, "plain-line", lines));
  const apexDots = [0, 1, 2].map(() => board.point(state.A, "apex-dot", 4, dots));
  const sideDots = [0, 1, 2].map(() => [
    board.point(state.A, "side-dot", 3.5, dots),
    board.point(state.A, "side-dot", 3.5, dots),
  ]);
  const meeting = board.point(state.A, "meet-dot", 5, dots);
  const labelKeys = ["A", "B", "C", "K", "L", "P", "Q", "M", "N", "A′", "B′", "C′"];
  const labels = {};
  for (const key of labelKeys) labels[key] = board.label(state.A, key, "point-label", 8, -8, texts);

  const handle = (name) => board.handle(name, state[name], {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move the triangle.`,
    onMove: (p, which) => {
      state = Core.move(state, which, p);
      render();
    },
  });
  const handles = { A: handle("A"), B: handle("B"), C: handle("C") };

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function centre(g) {
    return { x: (g.A.x + g.B.x + g.C.x) / 3, y: (g.A.y + g.B.y + g.C.y) / 3 };
  }

  function outward(from, p, size) {
    const dx = p.x - from.x, dy = p.y - from.y;
    const n = Math.hypot(dx, dy) || 1;
    return { dx: (dx / n) * size, dy: (dy / n) * size };
  }

  function render() {
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    outputs.up.textContent = state.options.up.toFixed(2);
    outputs.down.textContent = state.options.down.toFixed(2);
    outputs.angle.textContent = `${state.options.angle}°`;

    const g = Core.geometry(state);
    if (!g) {
      triangle.show(false);
      for (const s of bases.concat(...smallSides, cevians, plainLines, apexDots, ...sideDots)) s.show(false);
      meeting.show(false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    const mid = centre(g);
    triangle.show(true).set([g.A, g.B, g.C]);
    for (let i = 0; i < 3; i++) {
      const apex = g.apexes[i];
      const up = g.Up[i], down = g.Down[i];
      bases[i].show(true).set(down, up);
      sideDots[i][0].show(true).set(down);
      sideDots[i][1].show(true).set(up);
      for (const s of smallSides[i]) s.show(false);
      cevians[i].show(false);
      plainLines[i].show(false);
      apexDots[i].show(false);
      if (!apex) continue;
      smallSides[i][0].show(true).set(up, apex);
      smallSides[i][1].show(true).set(down, apex);
      apexDots[i].show(true).set(apex);
      if (g.showCevians) {
        cevians[i].show(true).set([g.A, g.B, g.C][i], apex);
      } else {
        plainLines[i].show(true).set([g.A, g.B, g.C][i], apex);
      }
    }
    meeting.show(g.valid && g.showCevians && !!g.torricelli);
    if (meeting.node.style.display !== "none" && g.torricelli) meeting.set(g.torricelli);

    /* Names move with their points; an outward nudge keeps them readable. */
    const baseNames = [["K", "L"], ["P", "Q"], ["M", "N"]];
    const apexNames = ["A′", "B′", "C′"];
    for (let i = 0; i < 3; i++) {
      const vertex = [g.A, g.B, g.C][i];
      const away = outward(mid, vertex, 13);
      labels["ABC"[i]].set(vertex, "ABC"[i], away.dx - 4, away.dy - 4);
      const baseAway = outward(mid, g.Up[i], 11);
      const along = outward([g.A, g.B, g.C][i], [g.A, g.B, g.C][(i + 1) % 3], 7);
      labels[baseNames[i][0]].set(g.Down[i], baseNames[i][0],
        baseAway.dx - along.dx - 3, baseAway.dy - along.dy - 3);
      labels[baseNames[i][1]].set(g.Up[i], baseNames[i][1],
        baseAway.dx + along.dx - 3, baseAway.dy + along.dy - 3);
      const apex = g.apexes[i];
      if (apex) {
        const apexAway = outward(mid, apex, 17);
        labels[apexNames[i]].set(apex, apexNames[i], apexAway.dx - 4, apexAway.dy - 4);
      }
    }
    for (const key of labelKeys) {
      const vertex = key === "A" ? g.A : key === "B" ? g.B : key === "C" ? g.C
        : key === "K" ? g.K : key === "L" ? g.L
          : key === "P" ? g.P : key === "Q" ? g.Q
            : key === "M" ? g.M : key === "N" ? g.N
              : g.apexes[apexNames.indexOf(key)];
      labels[key].show(state.options.names && !!vertex);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    // Board units, not screen pixels, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C,
        K: g.K, L: g.L, P: g.P, Q: g.Q, M: g.M, N: g.N,
        apexes: g.apexes, meeting: g.torricelli, options: state.options,
        claims: g.claims, measures: g.measures,
      });
    }
  }

  function syncControls() {
    controls.up.value = Math.round(state.options.up * 100);
    controls.down.value = Math.round(state.options.down * 100);
    controls.angle.value = state.options.angle;
    controls.names.checked = state.options.names;
  }

  for (const key of ["up", "down"]) {
    controls[key].addEventListener("input", () => {
      state = Core.setOption(state, key, Number(controls[key].value) / 100);
      render();
    });
  }
  controls.angle.addEventListener("input", () => {
    state = Core.setOption(state, "angle", Number(controls.angle.value));
    render();
  });
  controls.names.addEventListener("change", () => {
    state = Core.setOption(state, "names", controls.names.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    syncControls();
    render();
  });

  // SVG colours are CSS classes, but keep the shared redraw hook alive.
  board.onTheme(render);
  syncControls();
  render();
})();
