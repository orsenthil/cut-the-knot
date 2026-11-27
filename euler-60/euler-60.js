"use strict";

/*
 * The page for Euler 60: drawing and input only; the geometry lives in
 * euler-60-core.js. The stage is the applet's 400 x 300 board as an SVG:
 * three draggable corners, an Euler line, up to three marked centres, and
 * the three little eyes that open when a 60 degree angle is found.
 */

(function () {
  const Core = Euler60Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const presetButtons = document.querySelectorAll("[data-sixty]");
  const centerBoxes = document.querySelectorAll("[data-center]");

  let state = Core.start({});
  let pointer = Core.point(200, 150);

  /* Paint order: triangle, Euler line, cut, arcs, centres, labels, handles. */
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const centres = board.layer("centres");
  const text = board.layer("text");
  const tops = board.layer("handles");
  const eyes = board.layer("eyes");

  const triangle = board.polygon([state.A, state.B, state.C], "triangle", shapes);
  const euler = board.line(state.A, state.B, "euler-line", shapes);
  const cutLine = board.segment(state.A, state.B, "cut-line", marks);
  const cutP = board.point(state.A, "cut-point", 4, marks);
  const cutQ = board.point(state.B, "cut-point", 4, marks);
  const arc1 = board.angleArc(state.A, state.B, state.C, 20, "sixty-arc", marks);
  const arc2 = board.angleArc(state.A, state.B, state.C, 23, "sixty-arc", marks);
  const gDot = board.point(state.A, "center-dot centroid-dot", 4, centres);
  const oDot = board.point(state.B, "center-dot circumcenter-dot", 4, centres);
  const hDot = board.point(state.C, "center-dot orthocenter-dot", 4, centres);
  const labelA = board.label(state.A, "A", "pt-label", 12, -8, text);
  const labelB = board.label(state.B, "B", "pt-label", -18, -8, text);
  const labelC = board.label(state.C, "C", "pt-label", 8, -8, text);
  const labelG = board.label(state.A, "G", "center-label", 7, -7, text);
  const labelO = board.label(state.B, "O", "center-label", 7, -7, text);
  const labelH = board.label(state.C, "H", "center-label", 7, -7, text);

  /* The three mouse trackers from Euler60Canvas.init, at their board boxes. */
  const eyeBoxes = [
    { cx: [40, 60], cy: 30, r: 10 },
    { cx: [310, 330], cy: 70, r: 10 },
    { cx: [215, 245], cy: 25, r: 15 },
  ];
  const eyeParts = [];
  for (const box of eyeBoxes) {
    for (const cx of box.cx) {
      const white = board.el("path", null, "eye-white", eyes);
      const iris = board.circle({ x: cx, y: box.cy }, box.r / 2, "eye-iris", eyes);
      eyeParts.push({ box, cx, white, iris });
    }
  }
  eyes.setAttribute("aria-hidden", "true");

  const clampPoint = (p) => Core.point(
    Math.max(12, Math.min(state.width - 12, p.x)),
    Math.max(12, Math.min(state.height - 12, p.y)),
  );

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function movePoint(p, name) {
    state = Core.move(state, name, p);
    render();
  }

  const handleOptions = (name) => ({
    r: 12, step: 3, cls: "geom-handle", layer: tops,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move the corner.`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: clampPoint,
    onMove: (p, which) => movePoint(p, which),
  });
  const handles = {
    A: board.handle("A", state.A, handleOptions("A")),
    B: board.handle("B", state.B, handleOptions("B")),
    C: board.handle("C", state.C, handleOptions("C")),
  };

  /* Irises follow the pointer, as in mouseTracker; full eyes stare straight. */
  function drawEyes(open) {
    for (const eye of eyeParts) {
      const { cx, r, cy } = { ...eye.box, cx: eye.cx };
      if (open) {
        eye.white.setAttribute("d",
          `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`);
        eye.iris.set(Core.point(cx, cy), r / 2);
      } else {
        eye.white.setAttribute("d",
          `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`);
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const reach = r - r / 2;
        eye.iris.set(Core.point(cx + (dx / len) * reach, cy + (dy / len) * reach), r / 2);
      }
    }
  }

  function render() {
    const g = Core.geometry(state);
    triangle.set([state.A, state.B, state.C]);

    euler.show(g.lineVisible);
    if (g.lineVisible) euler.set(g.line.p, g.line.q);

    const cut = g.finished ? Core.cut(state, g.sixty.name) : null;
    cutLine.show(!!cut);
    cutP.show(!!cut);
    cutQ.show(!!cut);
    if (cut) {
      cutLine.set(cut.P, cut.Q);
      cutP.set(cut.P, 4);
      cutQ.set(cut.Q, 4);
    }
    arc1.show(g.finished);
    arc2.show(g.finished);
    if (g.finished) {
      arc1.set(g.sixty.S, g.sixty.T, g.sixty.U, 20);
      arc2.set(g.sixty.S, g.sixty.T, g.sixty.U, 23);
    }

    const visible = {
      centroid: state.show.centroid,
      circumcenter: state.show.circumcenter,
      orthocenter: state.show.orthocenter,
    };
    gDot.show(visible.centroid);
    labelG.show(visible.centroid);
    oDot.show(visible.circumcenter);
    labelO.show(visible.circumcenter);
    hDot.show(visible.orthocenter);
    labelH.show(visible.orthocenter);
    gDot.set(g.G, 4); labelG.set(g.G, "G", 7, -7);
    oDot.set(g.O, 4); labelO.set(g.O, "O", 7, -7);
    hDot.set(g.H, 4); labelH.set(g.H, "H", 7, -7);

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    labelA.set(state.A, "A", 12, -8);
    labelB.set(state.B, "B", -18, -8);
    labelC.set(state.C, "C", 8, -8);

    drawEyes(g.finished);

    if (g.finished) {
      const v = g.sixty.name;
      if (cut && cut.onSegments && g.lineVisible) {
        say(`Angle ${v} is 60°. The Euler line cuts off an equilateral triangle: BP = BQ = PQ ≈ ${Math.round(cut.PQ)}.`);
      } else if (cut && g.lineVisible) {
        say(`Angle ${v} is 60°. A side is more than twice the other, so the cut falls outside the triangle and AP + CQ = PQ fails.`);
      } else {
        say(`Angle ${v} is 60°. Here the circumcenter and orthocenter coincide, so there is no Euler line to see.`);
      }
    } else {
      const deg = (x) => Math.round((x * 180) / Math.PI);
      say(`Angles: A ${deg(g.angles.A)}°, B ${deg(g.angles.B)}°, C ${deg(g.angles.C)}°. Move a corner until one reads 60°.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  board.root.addEventListener("pointermove", (e) => {
    pointer = board.toLocal(e.clientX, e.clientY);
    drawEyes(Core.geometry(state).finished);
  });

  resetBtn.addEventListener("click", () => {
    state = Core.start({ width: state.width, height: state.height });
    render();
  });
  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.withSixty(state, "B", Number(btn.dataset.sixty));
      render();
    });
  });
  centerBoxes.forEach((box) => {
    box.checked = !!state.show[box.dataset.center];
    box.addEventListener("change", () => {
      state = Core.toggle(state, box.dataset.center);
      render();
    });
  });

  board.onTheme(render);
  render();
})();
