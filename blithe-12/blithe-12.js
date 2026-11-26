"use strict";

/*
 * The page for Blithe 12: drawing and input only; the rules live in
 * blithe-12-core.js. Three overlapping circles hold twelve counters on the
 * same six points the applet uses. Six of the counters are draggable,
 * focusable knobs: pressing one turns its circle one step in the direction the
 * applet's mouse click used. The knobs spring back, so a drag is one turn.
 */

(function () {
  const Core = Blithe12Core;
  const statusEl = document.getElementById("status");
  const modeEl = document.getElementById("modeSelect");
  const cyclesEl = document.getElementById("cyclesBox");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const cheatBtn = document.getElementById("cheatBtn");
  const resetBtn = document.getElementById("newBtn");

  /* The applet's own layout (reset()), scaled into a 400 x 290 viewBox. */
  const W = 400, H = 290, margin = 25, sq3 = Math.sqrt(3) / 2;
  const R = Math.floor((H - 2 * margin) / (2 + sq3));
  const span = Math.floor(R * (2 + sq3));
  const up = Math.floor(R * sq3);
  const half = Math.floor(R / 2);
  const cy = Math.floor(4 * margin / 3) + R;
  const centers = [
    { x: (W - span) / 2 + R, y: cy },
    { x: (W + span) / 2 - R, y: cy },
    { x: W / 2, y: H - Math.floor(2 * margin / 3) - R },
  ];
  const at = [
    { x: centers[0].x - half, y: centers[0].y - up },
    { x: centers[2].x, y: centers[0].y - up },
    { x: centers[1].x + half, y: centers[0].y - up },
    { x: centers[0].x - R, y: centers[0].y },
    { x: centers[2].x - half, y: centers[0].y },
    { x: centers[2].x + half, y: centers[0].y },
    { x: centers[1].x + R, y: centers[0].y },
    { x: centers[2].x - R, y: centers[2].y },
    { x: centers[2].x, y: centers[2].y },
    { x: centers[2].x + R, y: centers[2].y },
    { x: centers[2].x - half, y: centers[2].y + up },
    { x: centers[2].x + half, y: centers[2].y + up },
  ];

  /* The counters have their own colours in the four colour games. */
  const COLORS = ["#d9534f", "#49a86b", "#4b7fd4", "#a9773f", "#9a5aa8", "#35a09a", "#9aa1aa"];
  const CIRCLE_NAME = ["left", "right", "bottom"];

  const board = Geom.board(document.getElementById("board"));
  const ringsLayer = board.layer("rings");
  const countersLayer = board.layer("counters");
  const handlesLayer = board.layer("handles");
  const labelsLayer = board.layer("labels");

  const rings = centers.map((c) => board.circle(c, R, "ring", ringsLayer));
  const dots = [];
  for (let i = 0; i < Core.N; i++) {
    if (!Core.CONTROLLERS.some((h) => h.counter === i)) {
      dots[i] = board.point(at[i], "counter", 18, countersLayer);
    }
  }
  const glyphs = at.map((p) => board.label(p, "", "glyph", 0, 6, labelsLayer));

  let state = null;

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those classes are how the record learns that a play ended. This is an
   * illustration with no ending, so every message here is plain text.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    for (let i = 0; i < Core.N; i++) {
      const value = state.values[i];
      const colour = state.mode === 4 ? null : COLORS[value] || COLORS[6];
      const node = dots[i] ? dots[i].node : handleByCounter[i].node;
      if (colour) node.style.setProperty("--counter-fill", colour);
      else node.style.removeProperty("--counter-fill");
      glyphs[i].set(at[i], state.mode === 4 ? String(value) : "");
    }
    for (const h of handles) {
      const info = Core.CONTROLLERS[Number(h.node.getAttribute("data-controller"))];
      h.node.setAttribute("aria-label",
        `Counter ${info.counter + 1}, showing ${state.values[info.counter]}. ` +
        `Drag or press this knob to turn the ${CIRCLE_NAME[info.circle]} circle. Arrow keys and Enter also turn it.`);
    }
    cyclesEl.disabled = state.mode !== 4;
    if (state.hint && state.mode === 4) {
      say(`Cycles needed to put the counters home: ${Core.cycles(state.values)}. Turn the circles to undo them.`);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function flash(circle) {
    const ring = rings[circle].node;
    ring.classList.add("active");
    window.setTimeout(() => ring.classList.remove("active"), 450);
  }

  function play(m) {
    const next = Core.move(state, m);
    if (!next) return;
    state = next;
    const controller = Core.CONTROLLERS.find((h) => h.circle === m.circle && h.dir === m.dir);
    const way = m.dir > 0 ? "clockwise" : "the other way";
    const ending = Core.isHome(state) ? " All twelve counters are back home." : "";
    say(`Counter ${controller.counter + 1} turned the ${CIRCLE_NAME[m.circle]} circle ${way}. ` +
      `${state.moves} turns so far.${ending}`);
    flash(m.circle);
    render();
  }

  function newGame() {
    state = Core.start({ mode: Number(modeEl.value), hint: cyclesEl.checked });
    say("All twelve counters are home. Every starting order can be put back — shuffle and see.");
    render();
  }

  function onMode() {
    state = Core.start({ mode: Number(modeEl.value), hint: cyclesEl.checked });
    say(`${Core.MODE_NAMES[state.mode]}. Turn the circles to see how the colours move.`);
    render();
  }

  function onCycles() {
    state = { ...state, hint: cyclesEl.checked && state.mode === 4 };
    say(state.hint
      ? `Cycles needed to put the counters home: ${Core.cycles(state.values)}.`
      : "Cycles hidden. The six turns can undo any order.");
    render();
  }

  function onShuffle() {
    state = Core.shuffle(state, Math.random);
    say("Shuffled by 36 turns. The theorem says every one of these orders can be undone.");
    render();
  }

  function onCheat() {
    state = Core.cheat(state);
    say("Cheat: counters 1 and 4 traded places. The applet's Cheat button does just this one swap.");
    render();
  }

  /* Six knobs, one for each point of interaction in the original applet. */
  const handleByCounter = Object.create(null);
  const handles = Core.CONTROLLERS.map((info) => {
    const home = at[info.counter];
    const h = board.handle("counter-" + (info.counter + 1), home, {
      r: 18,
      step: 4,
      shift: 12,
      cls: "geom-handle control",
      label: `Counter ${info.counter + 1}. Drag it, or focus it and press Enter, to turn the ${CIRCLE_NAME[info.circle]} circle.`,
      // A knob always springs back: a drag is one turn, exactly like a click.
      clamp: () => ({ x: home.x, y: home.y }),
      onMove: () => render(),
      layer: handlesLayer,
    });
    h.node.setAttribute("data-controller", String(Core.CONTROLLERS.indexOf(info)));
    h.node.setAttribute("data-counter", String(info.counter));
    handleByCounter[info.counter] = h;
    h.node.style.setProperty("--counter-fill", "var(--accent)");
    // Geom captures the pointer on the SVG, so a later click lands on the SVG
    // root rather than on this circle. Use pointerdown for the one turn.
    h.node.addEventListener("pointerdown", () => play({ circle: info.circle, dir: info.dir }));
    h.node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key.startsWith("Arrow")) {
        e.preventDefault();
        play({ circle: info.circle, dir: info.dir });
        h.node.focus();
      }
    });
    return h;
  });

  board.onTheme(render);
  modeEl.addEventListener("change", onMode);
  cyclesEl.addEventListener("change", onCycles);
  shuffleBtn.addEventListener("click", onShuffle);
  cheatBtn.addEventListener("click", onCheat);
  resetBtn.addEventListener("click", newGame);

  modeEl.value = "4";
  newGame();
})();
