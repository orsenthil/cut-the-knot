"use strict";

/*
 * The page for Very Tiles. The board has two grids of twelve buttons: answer
 * tiles in order above, equations with a gap below. The rules, the moves and
 * the pattern encoding live in very-tiles-core.js; this file only draws them.
 * The buttons are kept, not rebuilt, so keyboard focus survives a match.
 */

(function () {
  const Core = VeryTilesCore;
  const tilesGrid = document.getElementById("tilesGrid");
  const problemsGrid = document.getElementById("problemsGrid");
  const statusEl = document.getElementById("status");
  const tilesBtn = document.getElementById("tilesBtn");
  const patternBtn = document.getElementById("patternBtn");
  const newBtn = document.getElementById("newBtn");

  const cells = { tile: [], problem: [] };
  let state = Core.start({ seed: 1 + Math.floor(Math.random() * 1000000) });
  let message = "";

  /**
   * Show a line under the game. `kind` is "done" or nothing, and the class is
   * how the player's record learns that the play has finished (there is no
   * win or loss in a demo).
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function cell(kind, pos) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    b.dataset.pos = String(pos);
    const label = document.createElement("span");
    label.className = "label";
    const glyph = document.createElement("span");
    glyph.className = "glyph";
    glyph.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 2; i++) glyph.appendChild(document.createElement("i"));
    b.append(label, glyph);
    b.addEventListener("click", () => play(kind, pos));
    b.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: Core.NCOLS, ArrowUp: -Core.NCOLS }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      if (kind === "tile" && step === Core.NCOLS && pos >= Core.NCOLS) {
        cells.problem[pos - Core.NCOLS].focus(); // down from the last answer row
      } else if (kind === "problem" && step === -Core.NCOLS && pos < Core.NCOLS) {
        cells.tile[pos + Core.NCOLS].focus(); // up from the first problem row
      } else {
        const to = Math.max(0, Math.min(Core.COUNT - 1, pos + step));
        cells[kind][to].focus();
      }
    });
    return b;
  }

  for (let pos = 0; pos < Core.COUNT; pos++) {
    const a = cell("tile", pos), b = cell("problem", pos);
    cells.tile.push(a); cells.problem.push(b);
    tilesGrid.appendChild(a); problemsGrid.appendChild(b);
  }

  const cornerName = { tl: "top left", tr: "top right", bl: "bottom left", br: "bottom right" };
  const plain = (text) => text.replace(/\+/g, " plus ").replace(/=/g, " equals ").replace(/\?/g, "unknown");

  function render() {
    const isPattern = state.mode === "pattern";
    const top = Core.pattern(state, "tiles"), bottom = Core.pattern(state, "problems");
    tilesGrid.classList.toggle("pattern", isPattern);
    problemsGrid.classList.toggle("pattern", isPattern);

    for (let pos = 0; pos < Core.COUNT; pos++) {
      const t = state.tiles[pos], p = state.problems[pos];
      const tileBtn = cells.tile[pos], problemBtn = cells.problem[pos];
      if (isPattern) {
        const g1 = tileBtn.querySelector(".glyph"), g2 = problemBtn.querySelector(".glyph");
        g1.dataset.color = top[pos].color; g1.dataset.corner = top[pos].corner;
        g2.dataset.color = bottom[pos].color; g2.dataset.corner = bottom[pos].corner;
        tileBtn.setAttribute("aria-label", `Answer pattern ${pos + 1}: ${top[pos].color} star at the ${cornerName[top[pos].corner]}`);
        problemBtn.setAttribute("aria-label", `Problem pattern ${pos + 1}: ${bottom[pos].color} star at the ${cornerName[bottom[pos].corner]}`);
      } else {
        tileBtn.querySelector(".label").textContent = t.show ? String(t.value) : "";
        problemBtn.querySelector(".label").textContent = Core.equation(state, pos);
        tileBtn.setAttribute("aria-label", t.show
          ? `Answer tile ${t.value}${state.selected && state.selected.kind === "tile" && state.selected.pos === pos ? ", selected" : ""}`
          : `Empty answer space ${pos + 1}${state.selected && state.selected.kind === "tile" && state.selected.pos === pos ? ", selected" : ""}`);
        problemBtn.setAttribute("aria-label", `Problem ${pos + 1}: ${plain(Core.equation(state, pos))}${state.selected && state.selected.kind === "problem" && state.selected.pos === pos ? ", selected" : ""}`);
      }
      for (const [btn, kind] of [[tileBtn, "tile"], [problemBtn, "problem"]]) {
        const on = state.selected && state.selected.kind === kind && state.selected.pos === pos;
        btn.classList.toggle("selected", !!on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
      tileBtn.classList.toggle("used", !isPattern && !t.show);
      problemBtn.classList.toggle("used", !isPattern && state.answers[pos] !== null);
    }

    const all = Core.allAnswered(state);
    tilesBtn.setAttribute("aria-pressed", isPattern ? "false" : "true");
    patternBtn.setAttribute("aria-pressed", isPattern ? "true" : "false");
    patternBtn.disabled = !all && !isPattern;
    patternBtn.title = all ? "Compare the two patterns" : "Place all twelve answers first";

    if (isPattern) {
      const agree = Core.patternsAgree(state);
      say(all
        ? (agree ? "The two patterns match — every answer is right." : "The patterns do not match — check your answers.")
        : "Both patterns are shown. Place all twelve answers to finish the check.", all ? "done" : null);
    } else if (all) {
      say("All answers are placed. Press Pattern to check them.", "done");
    } else {
      say(message || "Pick an answer tile, then the problem it belongs to.", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(kind, pos) {
    const before = state.answers.slice();
    state = Core.activate(state, kind, pos);
    if (state.selected) {
      message = state.selected.kind === "tile"
        ? `Answer tile ${state.tiles[state.selected.pos].value} picked. Now choose its problem.`
        : `Problem ${state.selected.pos + 1} picked. Now choose its answer tile, or a blank one to take an answer back.`;
    } else {
      const changed = state.answers.findIndex((v, i) => v !== before[i]);
      message = changed < 0 ? "Selection cleared."
        : state.answers[changed] === null
          ? `Took the answer back from problem ${changed + 1}.`
          : `Placed ${state.answers[changed]} in problem ${changed + 1}.`;
    }
    render();
  }

  function newGame() {
    state = Core.restart(state);
    message = "";
    render();
  }

  tilesBtn.addEventListener("click", () => { state = Core.setMode(state, "tiles"); render(); });
  patternBtn.addEventListener("click", () => { state = Core.setMode(state, "pattern"); render(); });
  newBtn.addEventListener("click", newGame);

  render();
})();
