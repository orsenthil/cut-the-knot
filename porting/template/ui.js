"use strict";

/*
 * TODO(port): the page for {{TITLE}}: drawing and input only. The rules are in
 * {{SLUG}}-core.js. Say in a sentence how the play area is laid out.
 */

(function () {
  const Core = {{CORE_GLOBAL}};
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");

  let state = null;

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

  function render() {
    // TODO(port): draw `state` into stageEl. Build elements with
    // document.createElement and textContent; attach listeners with
    // addEventListener. Every pressable thing is a <button> with an aria-label.

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(m) {
    const next = Core.move(state, m);
    if (!next) return; // not allowed: say why, if the applet did
    state = next;
    render();
    const result = Core.result(state);
    // TODO(port): the applet's own closing messages.
    if (result === "win") say("You won!", "win");
    else if (result === "lose") say("The computer wins.", "lose");
    else if (result === "done") say("Finished.", "done");
  }

  function newGame() {
    // TODO(port): read the options from .controls, with the applet's ranges.
    state = Core.start({});
    say("");
    render();
  }

  newBtn.addEventListener("click", newGame);
  // TODO(port): keyboard play (arrow keys, Enter), where the game has a cursor.

  newGame();
})();
