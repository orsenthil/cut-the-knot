"use strict";

/*
 * Eight Digits Puzzle - the UI. The graph and the rules live in
 * eight-digits-core.js.
 *
 * The board is drawn as SVG from the core's coordinates, so the figure and the
 * links can never drift apart from the logic that uses them. "Show safe links"
 * is the applet's "show complementary" checkbox: it swaps the drawn links for
 * the pairs of circles that do NOT touch, which is where consecutive digits
 * are allowed to go.
 */

(function () {
  const E = EightDigitsCore;

  const board = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nextEl = document.getElementById("nextDigit");
  const linksBtn = document.getElementById("linksBtn");
  const backBtn = document.getElementById("backBtn");

  const SVG = "http://www.w3.org/2000/svg";
  const R = 38;
  const xy = (cell) => ({ x: 50 + 100 * E.CELLS[cell].col, y: 50 + 100 * E.CELLS[cell].row });

  const game = new E.Game();
  let showSafe = false;

  const nodes = [];   // {g, disc, text}
  let linkLayer;

  function build() {
    board.textContent = "";
    linkLayer = document.createElementNS(SVG, "g");
    board.appendChild(linkLayer);

    for (let cell = 0; cell < E.N; cell++) {
      const { x, y } = xy(cell);
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("class", "node");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");

      const disc = document.createElementNS(SVG, "circle");
      disc.setAttribute("cx", x);
      disc.setAttribute("cy", y);
      disc.setAttribute("r", R);
      disc.setAttribute("class", "disc");
      g.appendChild(disc);

      const text = document.createElementNS(SVG, "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y + 1);
      text.setAttribute("class", "digit");
      g.appendChild(text);

      g.addEventListener("click", () => onClick(cell));
      g.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onClick(cell); }
      });
      board.appendChild(g);
      nodes.push({ g, disc, text });
    }
  }

  function drawLinks() {
    linkLayer.textContent = "";
    const pairs = showSafe ? E.COMPLEMENT : E.EDGES;
    for (const [a, b] of pairs) {
      const p = xy(a);
      const q = xy(b);
      const line = document.createElementNS(SVG, "line");
      line.setAttribute("x1", p.x);
      line.setAttribute("y1", p.y);
      line.setAttribute("x2", q.x);
      line.setAttribute("y2", q.y);
      line.setAttribute("class", showSafe ? "safe-link" : "link");
      linkLayer.appendChild(line);
    }
  }

  function render() {
    const clashing = new Set();
    for (const [a, b] of game.conflicts) { clashing.add(a); clashing.add(b); }
    const last = game.lastCell;

    for (let cell = 0; cell < E.N; cell++) {
      const { g, text } = nodes[cell];
      const digit = game.placement[cell];
      g.classList.toggle("filled", digit !== null);
      g.classList.toggle("clash", clashing.has(cell));
      g.classList.toggle("last", cell === last);
      text.textContent = digit === null ? "" : String(digit);
      const where = `circle ${cell + 1} of 8`;
      g.setAttribute("aria-label", digit === null
        ? `Empty ${where}`
        : `${where} holds ${digit}${clashing.has(cell) ? ", next to a consecutive digit" : ""}`);
    }

    nextEl.textContent = game.nextDigit === null ? "—" : String(game.nextDigit);
    backBtn.disabled = game.order.length === 0;
    drawLinks();
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle("win", kind === "win");
    statusEl.classList.toggle("lose", kind === "lose");
  }

  function report(res) {
    if (game.finished) {
      say("Solved! No two digits that follow each other are touching.", "win");
      return;
    }
    if (res && res.action === "place" && res.clash) {
      const [a, b] = res.clash;
      say(`${game.placement[a]} and ${game.placement[b]} are touching — step back and try another circle.`, "lose");
      return;
    }
    if (game.conflicts.length) {
      say(`Two digits that follow each other are still touching. Next digit: ${game.nextDigit}.`, "lose");
      return;
    }
    if (game.nextDigit === null) {
      say("All eight placed.");
      return;
    }
    say(game.order.length === 0
      ? "Click any circle to place the 1."
      : `Good so far. Now place the ${game.nextDigit}.`);
  }

  function onClick(cell) {
    const res = game.click(cell);
    if (res.action === "none") {
      if (game.placement[cell] !== null) {
        say(`That circle holds the ${game.placement[cell]}. Only the digit placed last can be taken back.`);
      }
      return;
    }
    render();
    report(res);
  }

  linksBtn.addEventListener("click", () => {
    showSafe = !showSafe;
    linksBtn.setAttribute("aria-pressed", String(showSafe));
    linksBtn.textContent = showSafe ? "Show the real links" : "Show safe links";
    render();
    say(showSafe
      ? "Dashed lines join circles that do NOT touch. Consecutive digits must follow them."
      : "Solid lines join circles that touch. Consecutive digits must avoid them.");
  });

  backBtn.addEventListener("click", () => {
    const undone = game.undo();
    render();
    if (!undone) { say("Nothing to take back."); return; }
    say(`Took back the ${undone.digit}. Next digit: ${game.nextDigit}.`);
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    game.reset();
    render();
    say("Board cleared. Click any circle to place the 1.");
  });

  build();
  render();
  say("Click any circle to place the 1.");
})();
