"use strict";

/*
 * The page for Euclid's proof: drawing and input only. The geometry and the
 * applet's integer rounding are in euclid-core.js.
 *
 * The board uses the applet's 400x400 coordinates. A yellow right triangle
 * sits fixed with its corner at (120, 270). The green triangle is built on
 * its sloping side and follows the draggable point; the magenta and red
 * triangles are built on the two legs by the core's two maps. The three
 * numbers at the lower right are the applet's displayed areas, in the same
 * order and colours. The three pairs of eyes are the applet's mouseTracker
 * decoration: they look at the point and open wide at the right-angle corner.
 */

(function () {
  const Core = EuclidCore;
  const statusEl = document.getElementById("status");
  const cornerBtn = document.getElementById("cornerBtn");
  const foldBtn = document.getElementById("foldBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const fills = board.layer("fills");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const eyesLayer = board.layer("eyes");
  const numbers = board.layer("numbers");
  const handles = board.layer("handles");

  const tr = Core.TRIANGLE;
  const base = board.polygon(tr, "base-tri", fills);
  const longTri = board.polygon(tr, "tri tri-long", shapes);
  const shortTri = board.polygon(tr, "tri tri-short", shapes);
  const hypTri = board.polygon(tr, "tri tri-hyp", shapes);
  const rightMark = board.rightAngle(Core.CORNER, tr[1], tr[2], 10, "right-mark", marks);

  // Each eye is a white oval, a lid, a blue iris, a small pupil and a rim.
  const eyeShapes = Core.EYES.map(() => ({
    white: [board.circle({ x: 0, y: 0 }, 1, "eye-white", eyesLayer),
            board.circle({ x: 0, y: 0 }, 1, "eye-white", eyesLayer)],
    lid: [board.el("path", null, "eye-lid", eyesLayer),
          board.el("path", null, "eye-lid", eyesLayer)],
    iris: [board.circle({ x: 0, y: 0 }, 1, "eye-iris", eyesLayer),
           board.circle({ x: 0, y: 0 }, 1, "eye-iris", eyesLayer)],
    pupil: [board.circle({ x: 0, y: 0 }, 2, "eye-pupil", eyesLayer),
            board.circle({ x: 0, y: 0 }, 2, "eye-pupil", eyesLayer)],
    rim: [board.circle({ x: 0, y: 0 }, 1, "eye-rim", eyesLayer),
          board.circle({ x: 0, y: 0 }, 1, "eye-rim", eyesLayer)],
  }));

  const longNumber = board.label({ x: 340, y: 340 }, "0", "num num-long", 0, 0, numbers);
  const shortNumber = board.label({ x: 340, y: 356 }, "0", "num num-short", 0, 0, numbers);
  const hypNumber = board.label({ x: 340, y: 372 }, "0", "num num-hyp", 0, 0, numbers);

  let state = Core.start();

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are how the player's record learns that a play has
   * ended. This is an illustration with no win or loss, so no kind is used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.figure(state);

    base.set(tr);
    longTri.set([f.long, tr[0], tr[2]]);
    shortTri.set([f.short, tr[1], tr[0]]);
    hypTri.set([f.mouse, tr[1], tr[2]]);
    rightMark.set(Core.CORNER, tr[1], tr[2], 10);

    f.eyes.forEach((eye, k) => {
      const shape = eyeShapes[k];
      for (let i = 0; i < 2; i++) {
        const center = eye.centers[i];
        shape.white[i].set(center, eye.r);
        shape.rim[i].set(center, eye.r);
        shape.iris[i].set(eye.irises[i], eye.iris);
        shape.pupil[i].set(eye.irises[i], 2);
        // AWT's 0..180 arc is the lid on a watching eye; a full eye has none.
        shape.lid[i].setAttribute("d",
          `M ${center.x - eye.r} ${center.y} A ${eye.r} ${eye.r} 0 0 1 ` +
          `${center.x + eye.r} ${center.y} Z`);
        shape.lid[i].style.display = eye.full ? "none" : "";
      }
    });

    longNumber.set({ x: 340, y: 340 }, String(f.shown.long), 0, 0);
    shortNumber.set({ x: 340, y: 356 }, String(f.shown.short), 0, 0);
    hypNumber.set({ x: 340, y: 372 }, String(f.shown.hyp), 0, 0);

    movingHandle.set(f.mouse);

    const sum = f.shown.long + f.shown.short;
    if (f.full) {
      say("At the right-angle corner: " + f.shown.long + " + " + f.shown.short +
          " = " + f.shown.hyp + ". The two small triangles fill the big one.");
    } else if (f.mouse.x === Core.PRESETS.fold.x && f.mouse.y === Core.PRESETS.fold.y) {
      say("Fold-in view: " + f.shown.long + " + " + f.shown.short +
          " = " + f.shown.hyp + ". The small triangles fold into the big one.");
    } else {
      say("Areas on the long side, short side and sloping side: " +
          f.shown.long + ", " + f.shown.short + ", " + f.shown.hyp +
          ". Move the point and watch them change.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveTo(p) {
    state = Core.withMouse(state, p.x, p.y);
    render();
  }

  const movingHandle = board.handle("moving", state.mouse, {
    r: 10, step: Core.APPLET.mouseStep, shift: 5,
    layer: handles,
    label: "Moving corner. Drag it, or focus it and use the arrow keys in steps of 2, to change the three triangles",
    describe: (p) => "at " + p.x + ", " + p.y,
    clamp: (p) => ({
      x: Geom.clamp(p.x, 0, Core.APPLET.width),
      y: Geom.clamp(p.y, 0, Core.APPLET.height),
    }),
    onMove: moveTo,
  });

  cornerBtn.addEventListener("click", () => {
    state = Core.preset("corner");
    render();
    movingHandle.node.focus();
  });
  foldBtn.addEventListener("click", () => {
    state = Core.preset("fold");
    render();
    movingHandle.node.focus();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
    movingHandle.node.focus();
  });

  // The classes follow the site's theme tokens; this keeps any computed
  // drawing in step when the theme flips.
  board.onTheme(render);

  render();
})();
