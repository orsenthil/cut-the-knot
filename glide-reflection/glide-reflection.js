"use strict";

/*
 * The page for Glide Reflection: drawing and input only. The transformation is
 * in glide-reflection-core.js. An SVG board holds the original polygons, the
 * dashed slide-only copies (when "intermediate" is ticked), the glide images and
 * the arrow whose two ends are the reflecting line. Geom handles let a pointer
 * or the arrow keys move an arrow end or one corner of the chosen polygon;
 * buttons add and remove polygons and walk through the arrows and shapes.
 */

(function () {
  const Core = GlideReflectionCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    axis: board.layer("axis"),
    ghosts: board.layer("ghosts"),
    images: board.layer("images"),
    shapes: board.layer("shapes"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);
  let selectedGlide = 0;
  let selectedShape = 0;
  const originals = [];
  const ghostPool = [];
  const imagePool = [];

  /** Status line; "done" tells the player's record that this demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const axisLine = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "axis-line", layers.axis);
  const arrowHead = board.polygon([{ x: 0, y: 0 }], "arrow-head", layers.axis);
  const labelA = board.label({ x: 0, y: 0 }, "A", "point-label", -15, -8, layers.labels);
  const labelB = board.label({ x: 0, y: 0 }, "B", "point-label", 7, 16, layers.labels);

  /** Arrowhead at Start (A), pointing away from End (B): GetVector is Start - End. */
  function headPoints(a, b, kind) {
    const dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const size = kind === 4 ? 15 : 11;
    const base = { x: a.x - size * ux, y: a.y - size * uy };
    return [a,
      { x: base.x - size * 0.55 * uy, y: base.y + size * 0.55 * ux },
      { x: base.x + size * 0.55 * uy, y: base.y - size * 0.55 * ux }];
  }

  function pool(list, count, cls, layer) {
    while (list.length < count) list.push(board.polygon([{ x: 0, y: 0 }], cls, layer));
    for (let i = 0; i < list.length; i++) list[i].show(i < count);
  }

  const endpoints = {};
  for (const which of ["a", "b"]) {
    endpoints[which] = board.handle(which, { x: 0, y: 0 }, {
      r: 9,
      step: 4,
      cls: "geom-handle endpoint-handle",
      layer: layers.handles,
      label: (which === "a" ? "Arrow head A" : "Arrow tail B") +
        ". Drag it, or focus it and use the arrow keys to move the reflecting line.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, name) => apply({ type: "point", index: selectedGlide, which: name, point: p },
        "Moved " + (name === "a" ? "arrow head A" : "arrow tail B") + " to (" +
        Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  const vertexHandles = Array.from({ length: Core.P_MAX }, (_, i) =>
    board.handle("v" + i, { x: 0, y: 0 }, {
      r: 7,
      step: 4,
      cls: "geom-handle vertex-handle",
      layer: layers.handles,
      label: "Corner " + (i + 1) + " of the chosen polygon. Drag it, or focus it and use the arrow keys.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      onMove: (p, name) => apply({ type: "vertex", shape: selectedShape, vertex: Number(name.slice(1)), point: p },
        "Moved corner " + (Number(name.slice(1)) + 1) + " of polygon " + (selectedShape + 1) + "."),
    }));

  function draw() {
    geometry = Core.compute(state);
    const vec = geometry.vectors[selectedGlide] || geometry.vectors[0];
    const kind = state.arrowKind;

    axisLine.set(vec.a, vec.b).show(true);
    arrowHead.set(headPoints(vec.a, vec.b, kind)).show(kind !== 0);
    arrowHead.node.setAttribute("class", "arrow-head" + (kind === 2 ? " arrow-open" : "") +
      (kind === 3 ? " arrow-solid" : "") + (kind === 4 ? " arrow-fixed" : ""));
    axisLine.node.setAttribute("class", "axis-line" + (kind === 3 ? " axis-thick" : ""));
    labelA.set(vec.a, "A").show(state.showDrags);
    labelB.set(vec.b, "B").show(state.showDrags);

    pool(originals, state.shapes.length, "original-poly", layers.shapes);
    state.shapes.forEach((poly, i) => originals[i].set(poly));

    pool(imagePool, geometry.images.length * state.shapes.length, "image-poly", layers.images);
    let k = 0;
    for (const step of geometry.images) {
      for (const poly of step) imagePool[k++].set(poly);
    }

    pool(ghostPool, state.showGhost ? geometry.ghosts.length * state.shapes.length : 0,
      "ghost-poly", layers.ghosts);
    k = 0;
    if (state.showGhost) {
      for (const step of geometry.ghosts) {
        for (const poly of step) ghostPool[k++].set(poly);
      }
    }

    for (const which of ["a", "b"]) {
      const handle = endpoints[which];
      handle.set(vec[which]).show(state.showDrags);
    }
    const shape = state.shapes[selectedShape];
    vertexHandles.forEach((handle, i) => {
      const on = state.showDrags && shape && i < shape.length;
      if (on) handle.set(shape[i]);
      handle.show(!!on);
    });
    document.getElementById("glideLabel").textContent =
      "Glide " + (selectedGlide + 1) + " of " + state.vectors.length;
    document.getElementById("shapeLabel").textContent = state.shapes.length
      ? "Polygon " + (selectedShape + 1) + " of " + state.shapes.length
      : "No polygons yet";
    document.getElementById("removeBtn").disabled = state.shapes.length === 0;
  }

  function statusText() {
    if (!state.shapes.length) return "No polygon yet. Press Add polygon to make one to copy.";
    const vec = geometry.vectors[selectedGlide] || geometry.vectors[0];
    const v = vec.v;
    return "Glide " + (selectedGlide + 1) + " slides by (" + Math.round(v.x) + ", " + Math.round(v.y) +
      ") and flips in its own line. Distances and angles stay the same, and the walk around the shape turns the other way." +
      (state.showGhost ? " Dashed shapes show the slide before the flip." : "");
  }

  /** Redraw, speak what happened and save the position for the player's record. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; a refused one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      for (const which of ["a", "b"]) endpoints[which].set(geometry.vectors[selectedGlide][which]);
      if (m.type === "vertex" && state.shapes[m.shape]) {
        vertexHandles[m.vertex].set(state.shapes[m.shape][m.vertex]);
      }
      say("That spot is too close to the other arrow end. Try a little further away.");
      return false;
    }
    state = next;
    selectedGlide = Math.min(selectedGlide, state.vectors.length - 1);
    selectedShape = Math.min(selectedShape, Math.max(0, state.shapes.length - 1));
    render();
    if (note) say(note, Core.result(state));
    return true;
  }

  const glideSel = document.getElementById("glideSel");
  const sidesSel = document.getElementById("sidesSel");
  const arrowSel = document.getElementById("arrowSel");
  const dragsBox = document.getElementById("dragsBox");
  const ghostBox = document.getElementById("ghostBox");

  for (let n = Core.N_MIN; n <= Core.N_MAX; n++) {
    glideSel.add(new Option(String(n), String(n)));
  }
  for (let p = Core.P_MIN; p <= Core.P_MAX; p++) {
    sidesSel.add(new Option(String(p), String(p)));
  }
  Core.ARROW_NAMES.forEach((name, i) => arrowSel.add(new Option(name, String(i))));
  glideSel.value = String(state.n);
  sidesSel.value = String(state.p);
  arrowSel.value = String(state.arrowKind);
  dragsBox.checked = state.showDrags;
  ghostBox.checked = state.showGhost;

  glideSel.addEventListener("change", () => apply({ type: "option", key: "n", value: Number(glideSel.value) },
    "Showing " + glideSel.value + " glide reflections in a row."));
  sidesSel.addEventListener("change", () => apply({ type: "option", key: "p", value: Number(sidesSel.value) },
    "New polygons will have " + sidesSel.value + " sides."));
  arrowSel.addEventListener("change", () => apply({ type: "option", key: "arrowKind", value: Number(arrowSel.value) },
    "The arrows now show " + Core.ARROW_NAMES[Number(arrowSel.value)].toLowerCase() + "."));
  dragsBox.addEventListener("change", () => apply({ type: "option", key: "showDrags", value: dragsBox.checked },
    dragsBox.checked ? "Showing the drag handles." : "Hidden the drag handles."));
  ghostBox.addEventListener("change", () => apply({ type: "option", key: "showGhost", value: ghostBox.checked },
    ghostBox.checked ? "Dashed copies show each slide before its flip." : "Hidden the slide-only copies."));

  document.getElementById("addBtn").addEventListener("click", () =>
    apply({ type: "add" }, "Added a " + state.p + "-sided polygon."));
  document.getElementById("removeBtn").addEventListener("click", () =>
    apply({ type: "remove" }, "Removed the newest polygon."));
  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }, "The arrows are back at their opening spots."));
  document.getElementById("prevGlide").addEventListener("click", () => {
    selectedGlide = (selectedGlide + state.vectors.length - 1) % state.vectors.length;
    render();
    say("Working on glide " + (selectedGlide + 1) + " of " + state.vectors.length + ".");
  });
  document.getElementById("nextGlide").addEventListener("click", () => {
    selectedGlide = (selectedGlide + 1) % state.vectors.length;
    render();
    say("Working on glide " + (selectedGlide + 1) + " of " + state.vectors.length + ".");
  });
  document.getElementById("prevShape").addEventListener("click", () => {
    if (!state.shapes.length) return;
    selectedShape = (selectedShape + state.shapes.length - 1) % state.shapes.length;
    render();
    say("Working on polygon " + (selectedShape + 1) + ".");
  });
  document.getElementById("nextShape").addEventListener("click", () => {
    if (!state.shapes.length) return;
    selectedShape = (selectedShape + 1) % state.shapes.length;
    render();
    say("Working on polygon " + (selectedShape + 1) + ".");
  });

  // Colours are CSS classes, so a theme flip only needs a fresh read of state.
  board.onTheme(() => draw());

  render();
})();
