"use strict";

/*
 * Browser UI for Clifford's Lemma. All the geometry and the applet's own
 * eight-try search live in clifford-theorem-core.js; this file only draws
 * them and takes input.
 *
 * The board holds four circles, each with a centre handle and a rim handle.
 * Dragging either one changes that circle; the crossings of neighbouring
 * circles are recomputed at once. When one point from each crossing pair lies
 * on a circle (red), the complementary four points are circled in blue, and
 * the three little pairs of eyes in the corners open, just as in the applet.
 */

(() => {
  const C = CliffordTheoremCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const circlesLayer = board.layer("circles");
  const spokesLayer = board.layer("spokes");
  const resultsLayer = board.layer("results");
  const crossingsLayer = board.layer("crossings");
  const eyesLayer = board.layer("eyes");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start({});
  let mouse = { x: 0, y: 0 };

  /**
   * Writes the line under the game. `kind` is "win", "lose", "done" or empty;
   * the three classes are the player's record's signals, so an illustration
   * never uses them.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  const baseCircles = [0, 1, 2, 3].map(() => board.circle({ x: 0, y: 0 }, 1, "base-circle", circlesLayer));
  const spokes = [0, 1, 2, 3].map(() => board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "spoke", spokesLayer));
  const redCircles = C.TRIES.map(() => board.circle({ x: 0, y: 0 }, 1, "red-circle", resultsLayer));
  const blueCircles = C.TRIES.map(() => board.circle({ x: 0, y: 0 }, 1, "blue-circle", resultsLayer));
  const crossingDots = [];
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 2; j++) crossingDots.push(board.point({ x: 0, y: 0 }, "crossing", 3.6, crossingsLayer));
  }
  const zDots = [0, 1, 2, 3].map(() => board.point({ x: 0, y: 0 }, "z-dot", 5, crossingsLayer));
  const wDots = [0, 1, 2, 3].map(() => board.point({ x: 0, y: 0 }, "w-dot", 5, crossingsLayer));
  const zLabels = [1, 2, 3, 4].map((n) => board.label({ x: 0, y: 0 }, `z${n}`, "z-label", 7, -7, labelsLayer));
  const wLabels = [1, 2, 3, 4].map((n) => board.label({ x: 0, y: 0 }, `w${n}`, "w-label", 7, 14, labelsLayer));
  const numberLabels = [0, 1, 2, 3].map((n) =>
    board.label({ x: 0, y: 0 }, String(n + 1), "num-label", -19, -13, labelsLayer));

  const eyeWhites = [0, 1, 2, 3, 4, 5].map(() => board.circle({ x: 0, y: 0 }, 1, "eye-white", eyesLayer));
  const eyeIrises = [0, 1, 2, 3, 4, 5].map(() => board.point({ x: 0, y: 0 }, "eye-iris", 3, eyesLayer));

  const clamp = (q) => ({
    x: Geom.clamp(q.x, 10, C.WIDTH - 10),
    y: Geom.clamp(q.y, 10, C.HEIGHT - 10),
  });
  const describe = (p) => `at x ${Math.round(p.x)}, y ${Math.round(p.y)} in the drawing`;
  const onMove = (p, name) => {
    state = C.withPoint(state, Number(name[1]), name[0] === "c" ? "center" : "rim", p);
    render();
  };
  const handles = [];
  for (let i = 0; i < 4; i++) {
    handles.push(board.handle(`c${i}`, state[i].center, {
      r: 13, step: 5, shift: 20, layer: handlesLayer, clamp, describe, onMove,
      label: `Circle ${i + 1} centre. Drag it, or focus it and use the arrow keys to move the whole circle`,
    }));
    handles.push(board.handle(`r${i}`, state[i].rim, {
      r: 13, step: 5, shift: 20, layer: handlesLayer, clamp, describe, onMove,
      label: `Circle ${i + 1} rim point. Drag it, or focus it and use the arrow keys to change the circle's size`,
    }));
  }

  function render() {
    const a = C.analyse(state);

    for (let i = 0; i < 4; i++) {
      handles[2 * i].set(state[i].center);
      handles[2 * i + 1].set(state[i].rim);
      baseCircles[i].set(a.circles[i], a.circles[i].r);
      spokes[i].set(state[i].center, state[i].rim);
      numberLabels[i].set(state[i].center);
    }

    for (let k = 0; k < 8; k++) {
      redCircles[k].show(false);
      blueCircles[k].show(false);
      zDots[k % 4].show(false);
      wDots[k % 4].show(false);
      zLabels[k % 4].show(false);
      wLabels[k % 4].show(false);
    }
    for (const d of crossingDots) d.show(false);

    for (let k = 0; k < a.pairs.length; k++) {
      for (let j = 0; j < 2; j++) crossingDots[2 * k + j].set(a.pairs[k][j]);
    }
    for (const [k, pair] of a.pairs.entries()) {
      for (let j = 0; j < 2; j++) crossingDots[2 * k + j].show(Boolean(pair));
    }
    for (const [i, f] of a.found.entries()) {
      redCircles[i].set(f.red, f.red.r).show(true);
      blueCircles[i].set(f.blue, f.blue.r).show(true);
      for (let k = 0; k < 4; k++) {
        zDots[k].set(f.z[k]).show(true);
        wDots[k].set(f.w[k]).show(true);
        zLabels[k].set(f.z[k]).show(true);
        wLabels[k].set(f.w[k]).show(true);
      }
      break; // the labels belong to one pair; all the circles are still drawn
    }

    const eyes = C.eyes(C.WIDTH, mouse, a.found.length > 0);
    for (let i = 0; i < eyes.length; i++) {
      const e = eyes[i];
      eyeWhites[i].set(e.center, e.R).show(true);
      eyeIrises[i].set(e.iris, e.open ? e.r * 1.3 : e.r * 0.6).show(true);
    }

    if (!a.order) {
      say("The four circles do not form a ring yet: make each circle meet the next.", "");
    } else if (!a.found.length) {
      say("The circles meet in a ring, but no four crossings lie on a circle.", "");
    } else {
      say(`Found ${a.found.length} Clifford pair${a.found.length === 1 ? "" : "s"}: ` +
        "each red circle through four crossings has a blue circle through the other four.", "");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  resetBtn.addEventListener("click", () => {
    state = C.start({});
    render();
  });

  board.root.addEventListener("pointermove", (e) => {
    mouse = board.toLocal(e.clientX, e.clientY);
    render();
  });
  board.root.addEventListener("pointerleave", () => {
    mouse = { x: 0, y: 0 };
    render();
  });

  board.onTheme(render);
  render();
})();
