"use strict";

/*
 * The page for Light Bulbs: drawing and input only. The ring is drawn once,
 * with one circle per possible bulb; each redraw just moves and shows those
 * shapes, so a handle keeps its keyboard focus. The green handle is the
 * visitor's bulb and the blue one is the bulb it will flip. All rules live in
 * light-bulbs-core.js.
 */

(function () {
  const Core = LightBulbsCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("resetBtn");
  const performBtn = document.getElementById("performBtn");
  const fastBox = document.getElementById("fastBox");
  const fields = {
    bulbs: document.getElementById("bulbsIn"),
    lookAhead: document.getElementById("lookIn"),
    skip: document.getElementById("skipIn"),
    steps: document.getElementById("stepsIn"),
  };

  const CENTER = { x: 200, y: 145 };
  const RING = 110;
  const MAX_BULBS = Core.LIMITS.bulbs[1];
  const ANIMATED_LIMIT = 60; // long batches are fast-forwarded to their exact end
  let state = null;
  let timer = null;

  // A position is needed before the first handle is placed on the ring.
  state = Core.start({
    bulbs: fields.bulbs.value, lookAhead: fields.lookAhead.value,
    skip: fields.skip.value, steps: fields.steps.value,
  });

  const board = Geom.board(document.getElementById("board"));
  const guideLayer = board.layer("guide");
  const bulbLayer = board.layer("bulbs");
  const arrowLayer = board.layer("arrows");
  const handleLayer = board.layer("handles");

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function ringPoint(index, radius) {
    const angle = (2 * Math.PI * index) / state.bulbs;
    return {
      x: CENTER.x + radius * Math.cos(angle),
      y: CENTER.y - radius * Math.sin(angle),
    };
  }

  function bulbRadius() {
    return Math.max(2, Math.min(Math.trunc((Math.PI * RING) / (state.bulbs + 2)), Math.trunc(RING / 10)));
  }

  // One circle and one number per possible bulb, created once and reused.
  const bulbs = [];
  const numbers = [];
  for (let i = 0; i < MAX_BULBS; i++) {
    bulbs.push(board.circle(CENTER, 2, "bulb", bulbLayer));
    numbers.push(board.label(CENTER, "", "bulb-index", 0, 0, bulbLayer));
  }
  const greenShaft = board.segment(CENTER, CENTER, "arrow-current", arrowLayer);
  const blueShaft = board.segment(CENTER, CENTER, "arrow-look", arrowLayer);
  const greenHead = board.polygon([CENTER, CENTER, CENTER], "head-current", arrowLayer);
  const blueHead = board.polygon([CENTER, CENTER, CENTER], "head-look", arrowLayer);
  board.circle(CENTER, RING, "ring", guideLayer);

  function arrowHead(index) {
    const tip = ringPoint(index, RING + 24);
    const back = ringPoint(index, RING + 13);
    const angle = (2 * Math.PI * index) / state.bulbs;
    const side = { x: 5 * Math.sin(angle), y: 5 * Math.cos(angle) };
    return [
      tip,
      { x: back.x + side.x, y: back.y + side.y },
      { x: back.x - side.x, y: back.y - side.y },
    ];
  }

  function nearestIndex(point) {
    const angle = Math.atan2(CENTER.y - point.y, point.x - CENTER.x);
    let index = Math.round((angle / (2 * Math.PI)) * state.bulbs);
    return ((index % state.bulbs) + state.bulbs) % state.bulbs;
  }

  function snapToBulb(point, name) {
    return ringPoint(nearestIndex(point), RING + 30);
  }

  const green = board.handle("current", ringPoint(0, RING + 30), {
    r: 9, step: 1, cls: "geom-handle current-handle", layer: handleLayer,
    label: "Current bulb. Drag around the ring, or use the arrow keys to move one bulb.",
    clamp: snapToBulb,
  });
  const blue = board.handle("look", ringPoint(0, RING + 30), {
    r: 9, step: 1, cls: "geom-handle look-handle", layer: handleLayer,
    label: "Look-ahead bulb. Drag around the ring, or use the arrow keys to change how far ahead it is.",
    clamp: snapToBulb,
  });

  // Geom's own arrow keys move in screen pixels; here one press means one bulb.
  function addBulbKeys(handle, name) {
    handle.node.addEventListener("keydown", (e) => {
      const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!direction) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stop();
      if (name === "current") {
        state = Core.setPosition(state, state.position + direction);
      } else {
        state = Core.setLookAhead(state, state.lookAhead + direction);
      }
      render();
      handle.node.focus();
    }, { capture: true });
  }
  addBulbKeys(green, "current");
  addBulbKeys(blue, "look");

  green.onMove((point) => {
    stop();
    state = Core.setPosition(state, nearestIndex(point));
    render();
  });
  blue.onMove((point) => {
    stop();
    const index = nearestIndex(point);
    const distance = ((index - state.position) % state.bulbs + state.bulbs) % state.bulbs;
    state = Core.setLookAhead(state, distance === 0 ? state.bulbs : distance);
    render();
  });

  function statusText() {
    const lit = state.on.filter(Boolean).length;
    if (Core.result(state) === "done") {
      return `Finished: ${state.stepsDone} steps, ${lit} of ${state.bulbs} bulbs lit. Press Reset to try again.`;
    }
    return `Step ${state.stepsDone} of ${state.steps}: ${lit} lit, ${state.bulbs - lit} dark. ` +
      `Visitor at bulb ${state.position}; the green arrow flips bulb ${Core.nextIndex(state)} (blue).`;
  }

  function render() {
    const radius = bulbRadius();
    for (let i = 0; i < MAX_BULBS; i++) {
      const on = i < state.bulbs;
      bulbs[i].show(on);
      numbers[i].show(on && state.bulbs <= 20);
      if (on) {
        const p = ringPoint(i, RING);
        bulbs[i].set(p, radius);
        bulbs[i].node.setAttribute("class", state.on[i] ? "bulb on" : "bulb off");
        numbers[i].set(ringPoint(i, RING + radius + 15), String(i));
      }
    }
    const from = ringPoint(state.position, RING + 4);
    const to = ringPoint(state.position, RING + 22);
    greenShaft.set(from, to);
    greenHead.set(arrowHead(state.position));
    const lookIndex = Core.nextIndex(state);
    const fromLook = ringPoint(lookIndex, RING + 4);
    const toLook = ringPoint(lookIndex, RING + 22);
    blueShaft.set(fromLook, toLook);
    blueHead.set(arrowHead(lookIndex));
    green.set(ringPoint(state.position, RING + 30));
    blue.set(ringPoint(lookIndex, RING + 30));

    say(statusText(), Core.result(state) === "done" ? "done" : "");
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(m) {
    const next = Core.move(state, m);
    if (!next) return; // not allowed: say why, if the applet did
    state = next;
    render();
  }

  function readOptions() {
    return {
      bulbs: fields.bulbs.value,
      lookAhead: fields.lookAhead.value,
      skip: fields.skip.value,
      steps: fields.steps.value,
    };
  }

  function stop() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    stageEl.classList.remove("busy");
    performBtn.disabled = false;
  }

  function newGame() {
    stop();
    state = Core.start(readOptions());
    render();
  }

  function perform() {
    if (timer !== null) return;
    if (Core.result(state) === "done") {
      say("This run is over. Press Reset to start another one.");
      return;
    }
    stageEl.classList.add("busy");
    performBtn.disabled = true;
    let shown = 0;
    const animated = Math.min(state.remaining, ANIMATED_LIMIT);
    const tick = () => {
      if (shown < animated) {
        play("step");
        shown++;
        timer = setTimeout(tick, Core.interval(fastBox.checked));
      } else {
        // Fast-forward the rest of the requested batch to its exact final
        // state instead of making the player wait up to 50 minutes.
        state = Core.run(state, state.remaining);
        stop();
        render();
      }
    };
    tick();
  }

  newBtn.addEventListener("click", newGame);
  performBtn.addEventListener("click", perform);
  for (const field of Object.values(fields)) {
    field.addEventListener("change", newGame);
  }
  board.onTheme(() => render());

  state = Core.start(readOptions());
  render();
})();
