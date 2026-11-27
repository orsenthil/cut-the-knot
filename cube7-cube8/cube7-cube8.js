"use strict";

/*
 * The page for Cube 7Cube 8: drawing and input only.
 *
 * The stage holds one SVG. Its 33 rhombi are created once and then moved with
 * Geom's shape .set() methods, so keyboard focus on the angle handle survives
 * every redraw. The core supplies both the picture and the numbers on the
 * three sliders, which copy the applet's three AWT scrollbars. There is no win
 * or lose here: this is a picture you turn around until the count flips.
 */

(function () {
  const Core = Cube7Cube8Core;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));
  const faceLayer = board.layer("faces");
  const edgeLayer = board.layer("edges");
  const handleLayer = board.layer("handles");

  const VIEW_W = 400;   // the applet's suggested canvas width
  const VIEW_H = 300;   // the applet's suggested canvas height
  const ANGLE_Y = 368;  // the handle sits below the drawing, inside the viewBox

  // One polygon and (where the applet strokes the edges) two broken lines per
  // rhombus. Nothing is rebuilt during play.
  const faceShapes = [];
  const nearShapes = [];
  const farShapes = [];
  for (let i = 0; i < 33; i++) {
    faceShapes.push(board.polygon([{ x: 0, y: 0 }], "cube-face", faceLayer));
    nearShapes.push(board.el("polyline", null, "cube-edge", edgeLayer));
    farShapes.push(board.el("polyline", null, "cube-edge", edgeLayer));
  }

  const angleHandle = board.handle("Angle", { x: Core.RANGES.angle.initial, y: ANGLE_Y }, {
    r: 15,
    step: 1,
    shift: 5,
    cls: "view-handle",
    layer: handleLayer,
    label: "View angle handle. Drag sideways, or focus it and press the left and right arrow keys.",
    describe: (p) => `Slant ${Math.round(p.x)} degrees.`,
    clamp: (q) => ({ x: Geom.clamp(Math.round(q.x), Core.RANGES.angle.min, Core.RANGES.angle.max), y: ANGLE_Y }),
    onMove: (p) => setOption("angle", p.x),
  });
  board.label({ x: Core.RANGES.angle.min, y: ANGLE_Y - 22 }, "15°", "handle-caption", 0, 0, handleLayer);
  board.label({ x: Core.RANGES.angle.max, y: ANGLE_Y - 22 }, "60°", "handle-caption", -18, 0, handleLayer);

  let state = Core.start({});

  /** A line under the picture. No win/lose classes: this is an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function edgeClass(colour) {
    return "cube-edge c" + colour.grey;
  }

  function render() {
    const picture = Core.faces(state, VIEW_W, VIEW_H);
    for (let i = 0; i < picture.length; i++) {
      const f = picture[i];
      const pts = f.pts.map(([x, y]) => ({ x, y }));
      const face = faceShapes[i];
      face.set(pts);
      face.node.setAttribute("class", "cube-face c" + f.fill.grey);
      face.node.style.setProperty("--face-alpha", String(f.fill.alpha / 255));

      // A polyline retraces from the shared corner between the two edges;
      // that avoids drawing the rhombus's diagonal.
      const setEdge = (node, colour, a, b, c) => {
        if (!colour) {
          node.style.display = "none";
          return;
        }
        node.style.display = "";
        node.setAttribute("class", edgeClass(colour));
        node.style.setProperty("--edge-alpha", String(colour.alpha / 255));
        node.setAttribute("points",
          `${a.x},${a.y} ${b.x},${b.y} ${a.x},${a.y} ${c.x},${c.y}`);
      };
      setEdge(nearShapes[i], f.nearEdge, pts[0], pts[1], pts[3]); // edges out of a
      setEdge(farShapes[i], f.farEdge, pts[2], pts[1], pts[3]);   // edges out of d
    }

    angleHandle.set({ x: state.angle, y: ANGLE_Y });
    document.getElementById("angle").value = String(state.angle);
    document.getElementById("size").value = String(state.n);
    document.getElementById("trans").value = String(state.trans);
    document.getElementById("angleOut").textContent = state.angle + "°";
    document.getElementById("sizeOut").textContent = String(state.n);
    document.getElementById("transOut").textContent = String(state.trans);

    const fading = state.trans === 0 ? "every face is solid" :
      state.trans > 0 ? "one set of faces is fading" : "the other set of faces is fading";
    say(`Slant ${state.angle}°, cube size ${state.n}, ${fading}. How many cubes do you see?`, null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setOption(key, value) {
    const next = Core.withOption(state, key, value);
    if (next[key] === state[key]) return;
    state = next;
    render();
  }

  const sliders = [
    ["angle", "angleOut", "angleDown", "angleUp", 5],
    ["size", "sizeOut", "sizeDown", "sizeUp", 1],
    ["trans", "transOut", "transDown", "transUp", 1],
  ];
  for (const [id, , downId, upId, pageStep] of sliders) {
    const key = id === "size" ? "n" : id;
    document.getElementById(id).addEventListener("input", (e) => setOption(key, Number(e.target.value)));
    document.getElementById(downId).addEventListener("click", () => setOption(key, state[key] - pageStep));
    document.getElementById(upId).addEventListener("click", () => setOption(key, state[key] + pageStep));
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.start({});
    render();
  });

  // CSS variables carry the colours, so a theme flip only needs a redraw of
  // the numbers; Geom.onTheme also listens to the OS setting.
  Geom.onTheme(() => render(), false);
  render();
})();
