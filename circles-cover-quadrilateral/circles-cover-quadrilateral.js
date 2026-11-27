"use strict";

/*
 * Browser UI for Circles Cover Quadrilateral. The geometry and the covering
 * test live in circles-cover-quadrilateral-core.js; this file only draws them
 * and takes input.
 *
 * The board shows the quadrilateral ABCD, its two diagonals, and the four
 * circles centred at the corners. Drag a corner (or use its arrow keys), move
 * a radius slider, or click inside a circle to hide/show it exactly as the
 * applet does. The status line reports whether the four circles cover the
 * quadrilateral and which triangle is covered by its three circles. There is
 * no win and no loss: this is an illustration, so exploring it marks it done.
 */

(() => {
  const C = CirclesCoverQuadrilateralCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const fitBtn = document.getElementById("fitBtn");
  const resetBtn = document.getElementById("resetBtn");
  const sliders = {};
  const readouts = {};
  const circleButtons = {};
  for (const name of C.NAMES) {
    sliders[name] = document.getElementById("radius" + name);
    readouts[name] = document.getElementById("readout" + name);
    circleButtons[name] = document.getElementById("toggle" + name);
  }

  let state = C.start();

  /* Layers, back to front. Shapes are created once and moved with .set(), so
     a handle keeps keyboard focus across every redraw. */
  const fills = board.layer("fills");
  const circlesLayer = board.layer("circles");
  const guides = board.layer("guides");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const quadShape = board.polygon([state.A, state.B, state.C, state.D], "quad-fill", fills);
  const coveredTri = board.polygon([state.A, state.B, state.C], "covered-tri", fills);
  const diagonals = [
    board.segment(state.A, state.C, "diag", guides),
    board.segment(state.B, state.D, "diag", guides),
  ];
  const circles = C.NAMES.map((name) => board.circle(state[name], 1, "cover-circle", circlesLayer));
  const labels = {};
  const labelOffset = { A: [-18, -10], B: [-18, 20], C: [10, 18], D: [10, -10] };
  for (const name of C.NAMES) {
    labels[name] = board.label(state[name], name, "point-label",
      labelOffset[name][0], labelOffset[name][1], labelsLayer);
  }

  const handleOptions = {
    r: 10, step: 5, shift: 15, layer: handlesLayer,
    clamp: (p) => C.clamp(p),
    describe: (p) => `at x ${Math.round(p.x)}, y ${Math.round(p.y)} in the drawing`,
    label: "Corner. Drag it, or focus it and use the arrow keys to move the quadrilateral.",
    onMove: (p, name) => {
      state = C.moveVertex(state, name, p);
      render();
    },
  };
  const handles = {};
  for (const name of C.NAMES) {
    handles[name] = board.handle(name, state[name], Object.assign({}, handleOptions, {
      label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move the quadrilateral`,
    }));
  }

  /** The status line is also how the player's record sees an explored demo. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    /* A coarse mesh is enough for the picture. When it reports the theorem's
     * hypothesis but a borderline triangle, look again with a finer mesh. */
    let geo = C.geometry(state, 8);
    if (geo && geo.hypothesis && (!geo.conclusion || !geo.quad.certainCovered)) {
      geo = C.geometry(state, 2) || geo;
    }

    quadShape.set([state.A, state.B, state.C, state.D]);
    diagonals[0].set(state.A, state.C);
    diagonals[1].set(state.B, state.D);
    for (let i = 0; i < 4; i++) {
      const disk = geo ? geo.disks[i] : C.disks(state)[i];
      circles[i].set(state[C.NAMES[i]], state.radii[i]);
      circles[i].show(true);
      circles[i].node.setAttribute("class", disk.on ? "cover-circle" : "cover-circle off");
      const name = C.NAMES[i];
      sliders[name].value = String(state.radii[i]);
      readouts[name].textContent = String(state.radii[i]);
      const verb = state.on[i] ? "Hide" : "Show";
      circleButtons[name].textContent = `${verb} ${name}`;
      circleButtons[name].setAttribute("aria-label", `${verb} circle ${name}`);
      circleButtons[name].setAttribute("aria-pressed", String(state.on[i]));
      labels[name].set(state[name]);
      handles[name].set(state[name]);
    }

    /* Light up the first triangle whose own three circles cover it. */
    const covered = geo ? geo.triangles.filter((t) => t.own.covered) : [];
    if (covered.length) {
      coveredTri.set(covered[0].vertices.map((i) => state[C.NAMES[i]]));
      coveredTri.show(true);
    } else {
      coveredTri.show(false);
    }

    say(C.describe(state, geo), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D,
        radii: state.radii.slice(), on: state.on.slice(),
        hypothesis: !!(geo && geo.hypothesis),
        conclusion: !!(geo && geo.conclusion),
        coveredTriangles: covered.map((t) => t.name),
      });
    }
  }

  for (const name of C.NAMES) {
    sliders[name].addEventListener("input", () => {
      state = C.setRadius(state, C.NAMES.indexOf(name), Number(sliders[name].value));
      render();
    });
    circleButtons[name].addEventListener("click", () => {
      state = C.toggleCircle(state, C.NAMES.indexOf(name));
      render();
    });
  }

  /* The applet's mouseClicked(): click anywhere inside a circle to flip it.
   * A drag that started on a corner belongs to the corner, not the circles:
   * the browser may still deliver a click when the pointer is released over a
   * circle, so remember where the press began. */
  let dragFromHandle = false;
  board.root.addEventListener("pointerdown", (e) => {
    dragFromHandle = !!(e.target.classList && e.target.classList.contains("geom-handle"));
  });
  board.root.addEventListener("pointerup", () => {
    setTimeout(() => { dragFromHandle = false; }, 0);
  });
  board.root.addEventListener("click", (e) => {
    if (dragFromHandle || (e.target.classList && e.target.classList.contains("geom-handle"))) {
      dragFromHandle = false;
      return;
    }
    const p = board.toLocal(e.clientX, e.clientY);
    state = C.toggleAt(state, p);
    render();
  });

  resetBtn.addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  fitBtn.addEventListener("click", () => {
    state = Object.assign({}, state, {
      radii: C.fitRadii(state), on: [true, true, true, true], explored: true,
    });
    render();
  });

  board.onTheme(render);
  render();
})();
