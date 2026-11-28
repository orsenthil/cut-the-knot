"use strict";

/*
 * The page for Homothety: drawing and input only. The arithmetic lives in
 * homothety-core.js. Each homothety has a blue center and a horizontal slider
 * with orange O (0), red U (1) and blue V (the coefficient). Polygons and
 * their successive images are drawn behind the original shapes; rays from a
 * center and the lines of a product can be switched on in the controls.
 */

(function () {
  const Core = HomothetyCore;
  const statusEl = document.getElementById("status");
  const countInput = document.getElementById("countInput");
  const sidesInput = document.getElementById("sidesInput");
  const countBtn = document.getElementById("countBtn");
  const addBtn = document.getElementById("addBtn");
  const removeBtn = document.getElementById("removeBtn");
  const newBtn = document.getElementById("newBtn");
  const linesChk = document.getElementById("linesChk");
  const dragsChk = document.getElementById("dragsChk");
  const productChk = document.getElementById("productChk");

  const board = Geom.board(document.getElementById("board"));
  const raysLayer = board.layer("rays");
  const imagesLayer = board.layer("images");
  const productsLayer = board.layer("products");
  const originalsLayer = board.layer("originals");
  const axisLayer = board.layer("axes");
  const labelsLayer = board.layer("labels");
  const centerLayer = board.layer("center-handles");
  const vertexLayer = board.layer("vertex-handles");

  let state = Core.start({ seed: 1 });
  let rows = [];
  let vertexHandles = [];
  let vertexSignature = "";

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those classes are how the record learns that a play has ended. This
   * applet is an illustration, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const clampCenter = (p) => ({
    x: Geom.clamp(p.x, 10, Core.WIDTH - 10),
    y: Geom.clamp(p.y, 10, Core.HEIGHT - 10),
  });
  const clampSlider = (p, i) => ({
    x: Geom.clamp(p.x, 4, Core.WIDTH - 4),
    y: state.transforms[i] ? state.transforms[i].slider.O.y : p.y,
  });

  function moveControl(i, name, p) {
    state = Core.withTransformPoint(state, i, name, p);
    render();
  }

  const handleOptions = (name, label, clamp, move, cls) => ({
    r: 10, step: 5, shift: 25, layer: centerLayer, cls: cls || "geom-handle",
    label: label,
    describe: (p) => `at x ${Math.round(p.x)} and y ${Math.round(p.y)}`,
    clamp: clamp,
    onMove: move,
  });

  /* A row is rebuilt only when the number of homotheties changes, so keyboard
   * focus stays on the same circle while a point is moved. */
  function rebuildRows() {
    board.clear(axisLayer);
    board.clear(labelsLayer);
    board.clear(centerLayer);
    rows = [];
    for (let i = 0; i < state.count; i++) {
      const t = state.transforms[i];
      const n = String(i + 1);
      const axis = board.segment(t.slider.O, t.slider.U, "slider-axis", axisLayer);
      const tag = board.label(t.center, "H" + n, "center-tag", 11, -10, labelsLayer);
      const entry = {
        axis: axis,
        tag: tag,
        center: board.handle("C" + n, t.center, handleOptions(
          "C" + n,
          "Center O of homothety " + n + ". Drag it, or focus it and use the arrow keys, to move the center.",
          clampCenter, (p) => moveControl(i, "center", p))),
        O: board.handle("O" + n, t.slider.O, handleOptions(
          "O" + n,
          "Orange point O of homothety " + n + ", the zero mark. Drag it, or focus it and use the arrow keys, along its slider.",
          (p) => clampSlider(p, i), (p) => moveControl(i, "O", p), "geom-handle slider-o")),
        U: board.handle("U" + n, t.slider.U, handleOptions(
          "U" + n,
          "Red point U of homothety " + n + ", the one mark. Drag it, or focus it and use the arrow keys, along its slider.",
          (p) => clampSlider(p, i), (p) => moveControl(i, "U", p), "geom-handle slider-u")),
        V: board.handle("V" + n, t.slider.V, handleOptions(
          "V" + n,
          "Blue point V of homothety " + n + ", the coefficient. Drag it, or focus it and use the arrow keys, along its slider.",
          (p) => clampSlider(p, i), (p) => moveControl(i, "V", p), "geom-handle slider-v")),
      };
      rows.push(entry);
    }
  }

  function signature() {
    return state.polygons.map((p) => p.vertices.length).join(",");
  }

  function rebuildVertexHandles() {
    board.clear(vertexLayer);
    vertexHandles = [];
    state.polygons.forEach((poly, pi) => {
      poly.vertices.forEach((p, vi) => {
        const name = "P" + (pi + 1) + "." + (vi + 1);
        const h = board.handle(name, p, {
          r: 6, step: 3, shift: 15, cls: "geom-handle vertex-handle", layer: vertexLayer,
          label: "Corner " + (vi + 1) + " of polygon " + (pi + 1) +
            ". Drag it, or focus it and use the arrow keys, to reshape the polygon.",
          describe: (q) => "at x " + Math.round(q.x) + " and y " + Math.round(q.y),
          clamp: clampCenter,
          onMove: (q) => {
            state = Core.withVertex(state, pi, vi, q);
            render();
          },
        });
        vertexHandles.push(h);
      });
    });
    vertexSignature = signature();
  }

  function render() {
    const sig = signature();
    if (rows.length !== state.count) rebuildRows();
    if (sig !== vertexSignature) rebuildVertexHandles();

    // The transformed copies, behind the original shapes, are chained exactly
    // as DrawHomotheties chains them in the applet.
    board.clear(imagesLayer);
    board.clear(raysLayer);
    board.clear(productsLayer);
    let previous = state.polygons.map((p) => p.vertices);
    Core.images(state).forEach((shapes, i) => {
      const center = state.transforms[i].center;
      shapes.forEach((pts) => {
        board.polygon(pts, "image-shape image-" + (i % 4), imagesLayer);
        if (state.showLines) {
          previous.forEach((poly) => poly.forEach((p) => board.line(center, p, "ray", raysLayer)));
          pts.forEach((p) => board.line(center, p, "ray", raysLayer));
        }
      });
      previous = shapes;
    });

    if (state.showProduct && state.count > 1 && state.polygons.length) {
      const final = Core.finalPolygons(state);
      state.polygons.forEach((poly, pi) => poly.vertices.forEach((p, vi) => {
        board.segment(p, final[pi][vi], "product-line", productsLayer);
      }));
    }

    board.clear(originalsLayer);
    state.polygons.forEach((poly) => board.polygon(poly.vertices, "original-shape", originalsLayer));

    state.transforms.forEach((t, i) => {
      const r = rows[i];
      if (!r) return;
      r.axis.set(t.slider.O, t.slider.U);
      r.tag.set(t.center);
      r.center.set(t.center);
      r.O.set(t.slider.O);
      r.U.set(t.slider.U);
      r.V.set(t.slider.V);
      r.center.show(state.showDragControls);
      r.O.show(state.showDragControls);
      r.U.show(state.showDragControls);
      r.V.show(state.showDragControls);
    });
    vertexHandles.forEach((h) => h.show(state.showDragControls));

    removeBtn.disabled = state.polygons.length === 0;
    countInput.value = String(state.count);
    sidesInput.value = String(state.sides);
    linesChk.checked = state.showLines;
    dragsChk.checked = state.showDragControls;
    productChk.checked = state.showProduct;

    const ks = state.transforms.map((t, i) =>
      "H" + (i + 1) + " k=" + Core.coefficient(t).toFixed(2)).join("  ·  ");
    const shapes = state.polygons.length === 1 ? "1 polygon" : state.polygons.length + " polygons";
    say(state.polygons.length
      ? ks + ". " + shapes + ". O marks 0, U marks 1 and V sets the stretch."
      : ks + ". Press Add polygon to make a shape to stretch.");

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function applyCount() {
    const n = Core.setCount(state, countInput.value);
    if (n !== state) {
      state = n;
      rebuildRows();
    }
    render();
  }

  countBtn.addEventListener("click", applyCount);
  countInput.addEventListener("change", applyCount);
  addBtn.addEventListener("click", () => {
    state = Core.addPolygon(state, sidesInput.value);
    render();
  });
  removeBtn.addEventListener("click", () => {
    state = Core.removeLastPolygon(state);
    render();
  });
  newBtn.addEventListener("click", () => {
    const fresh = Core.start({
      count: state.count,
      sides: Number(sidesInput.value),
      seed: (state.seed + 1) >>> 0 || 1,
    });
    fresh.polygons = state.polygons;
    fresh.showLines = state.showLines;
    fresh.showDragControls = state.showDragControls;
    fresh.showProduct = state.showProduct;
    state = fresh;
    rebuildRows();
    render();
  });
  linesChk.addEventListener("change", () => {
    state = Core.withFlag(state, "lines", linesChk.checked);
    render();
  });
  dragsChk.addEventListener("change", () => {
    state = Core.withFlag(state, "drags", dragsChk.checked);
    render();
  });
  productChk.addEventListener("change", () => {
    state = Core.withFlag(state, "product", productChk.checked);
    render();
  });

  board.onTheme(render);
  rebuildRows();
  render();
})();
