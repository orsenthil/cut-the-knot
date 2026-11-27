"use strict";

/*
 * The drawing and input for Circle Triplet.  All the geometry is in
 * circle-triplet-core.js; this file only puts the arbelos, the three equal
 * circles, the tangent circle and its tangency triangle on an SVG board.  A,
 * B and C are draggable handles on the baseline; the two checkboxes reproduce
 * the applet's "names" and "hint" options, and Reset restores its starting
 * figure.  The hint shows the inversion at A that proves the radius equality.
 */

(function () {
  const Core = CircleTripletCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: the filled arbelos, its three arcs and baseline,
   * the tangency triangle, the circles, the inversion hint, dots, names, then
   * the handles that keep keyboard focus. */
  const fills = board.layer("fills");
  const arcs = board.layer("arcs");
  const triangle = board.layer("triangle");
  const rings = board.layer("rings");
  const hintLayer = board.layer("hint");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const fillBig = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "fill-arbelos", fills);
  const fillLeft = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "fill-cut", fills);
  const fillRight = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "fill-cut", fills);
  const bigArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc arc-big", arcs);
  const leftArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc", arcs);
  const rightArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc", arcs);
  const baseline = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "baseline", arcs);
  const upright = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "upright", arcs);

  const triEdges = [
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "tri-edge", triangle),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "tri-edge", triangle),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "tri-edge", triangle),
  ];

  const twin1 = board.circle({ x: 0, y: 0 }, 1, "ring ring-twin", rings);
  const twin2 = board.circle({ x: 0, y: 0 }, 1, "ring ring-twin", rings);
  const brother = board.circle({ x: 0, y: 0 }, 1, "ring ring-brother", rings);
  const reflected = board.circle({ x: 0, y: 0 }, 1, "ring ring-reflected", rings);
  const w3 = board.circle({ x: 0, y: 0 }, 1, "ring ring-w3", rings);
  const w3ref = board.circle({ x: 0, y: 0 }, 1, "ring ring-reflected", rings);

  const invCircle = board.circle({ x: 0, y: 0 }, 1, "hint-circle", hintLayer);
  const invShapes = ["twin1", "twin2", "w3", "brother"].map((key) => ({
    key: key,
    ring: board.circle({ x: 0, y: 0 }, 1, "hint-circle", hintLayer),
    ray: board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-ray", hintLayer),
  }));

  const dotK = board.point({ x: 0, y: 0 }, "dot dot-k", 3.5, dots);
  const dotL = board.point({ x: 0, y: 0 }, "dot dot-k", 3.5, dots);

  const labelText = {
    A: "A", B: "B", C: "C", K: "K", L: "L",
    W1: "W₁", W2: "W₂", W3: "W₃", O3: "O₃",
  };
  const labelOffsets = {
    A: [-7, 18], B: [-7, 18], C: [-7, 18],
    K: [-17, -6], L: [5, -6],
    W1: [-15, 4], W2: [5, 4], W3: [-15, 4], O3: [-10, -7],
  };
  const labels = {};
  for (const key of Object.keys(labelText)) {
    const off = labelOffsets[key];
    labels[key] = board.label({ x: 0, y: 0 }, labelText[key],
      "point-label", off[0], off[1], names);
  }

  const handleLabel = {
    A: "Point A, left end of the baseline",
    B: "Point B, right end of the baseline",
    C: "Point C, the dividing point",
  };
  const handleOpts = (name) => ({
    label: handleLabel[name],
    r: 8, step: 5, shift: 15, layer: top,
    clamp: (q, which) => Core.project(state, which, q),
    describe: (p) => "at x = " + Math.round(p.x) + ", on the baseline",
    onMove: (p, which) => {
      state = Core.move(state, which, p);
      render();
    },
  });
  const handles = {
    A: board.handle("A", state.A, handleOpts("A")),
    B: board.handle("B", state.B, handleOpts("B")),
    C: board.handle("C", state.C, handleOpts("C")),
  };

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);

    const semi = (shape, circle) => shape.set(circle.c, circle.r, Math.PI, 2 * Math.PI);
    semi(fillBig, g.big);
    semi(fillLeft, g.left);
    semi(fillRight, g.right);
    semi(bigArc, g.big);
    semi(leftArc, g.left);
    semi(rightArc, g.right);
    baseline.set(g.A, g.B);
    upright.set(g.C, g.D);

    triEdges[0].set(g.K, g.L);
    triEdges[1].set(g.L, g.C);
    triEdges[2].set(g.C, g.K);

    twin1.set(g.twin1.c, g.twin1.r);
    twin2.set(g.twin2.c, g.twin2.r);
    brother.set(g.brother.c, g.brother.r);
    reflected.set(g.reflected.c, g.reflected.r);
    w3.set(g.W3.c, g.W3.r);
    w3ref.set(g.W3ref.c, g.W3ref.r);
    dotK.set(g.K);
    dotL.set(g.L);

    invCircle.set(g.inversion.c, g.inversion.r);
    const images = {
      twin1: Core.invertCircle(g.twin1, g.inversion),
      twin2: Core.invertCircle(g.twin2, g.inversion),
      w3: Core.invertCircle(g.W3, g.inversion),
      brother: Core.invertCircle(g.brother, g.inversion),
    };
    for (const item of invShapes) {
      const image = images[item.key];
      item.ring.show(!!image);
      item.ray.show(!!image);
      if (image) {
        item.ring.set(image.c, image.r);
        item.ray.set(g.A, image.c);
      }
    }
    for (const shape of [invCircle]) shape.show(state.options.hint);

    const at = {
      A: g.A, B: g.B, C: g.C, K: g.K, L: g.L,
      W1: g.twin1.c, W2: g.twin2.c, W3: g.W3.c, O3: g.brother.c,
    };
    for (const key of Object.keys(labels)) {
      labels[key].set(at[key]);
      labels[key].show(state.options.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, O: g.O, O1: g.O1, O2: g.O2, D: g.D,
        K: g.K, L: g.L,
        circles: {
          big: g.big, left: g.left, right: g.right,
          twin1: g.twin1, twin2: g.twin2,
          brother: g.brother, reflected: g.reflected,
          W3: g.W3, W3ref: g.W3ref, inversion: g.inversion,
        },
        r1: g.r1, r2: g.r2, R: g.R, radius: g.p, R3: g.R3,
        options: state.options,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("hint", hintBox);

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
