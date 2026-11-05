"use strict";

/*
 * The Game of Jam - the page.
 *
 * Rules and the computer live in jam-core.js; this file draws the map and
 * runs the turns, as the applet did: you claim a road and the computer
 * replies at once; "Computer moves first" (the applet's "I move first")
 * enables Start, which has the computer open; the score is kept as the
 * applet's "It's now computer:you". "Show the secret" draws the same
 * position on a tic-tac-toe board numbered with the applet's magic square.
 *
 * Each road is drawn twice: a wide transparent line that takes the click or
 * keyboard focus, then the visible road on top of it.
 */

(() => {
  const J = JamCore;

  const map = document.getElementById("map");
  const secret = document.getElementById("secret");
  const stage = document.getElementById("stage");
  const firstInput = document.getElementById("firstInput");
  const startBtn = document.getElementById("startBtn");
  const clearBtn = document.getElementById("clearBtn");
  const secretInput = document.getElementById("secretInput");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");

  const SVG = "http://www.w3.org/2000/svg";
  const S = 300;
  const P = J.CITIES.map(([x, y]) => [x * S, y * S]);
  const ROW_NAMES = ["top left", "top middle", "top right", "middle left", "centre", "middle right", "bottom left", "bottom middle", "bottom right"];

  let game = J.start();
  const score = { computer: 0, you: 0 };
  const roads = [];
  const hits = [];
  const cities = [];
  const squares = [];
  const numbers = [];

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function build() {
    J.ROAD_ENDS.forEach(([a, b], i) => {
      const hit = el("line", { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], class: "road-hit", tabindex: "0", role: "button" });
      const road = el("line", { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], class: "road" });
      hit.addEventListener("click", () => claim(i));
      hit.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); claim(i); }
      });
      map.appendChild(hit);
      map.appendChild(road);
      hits.push(hit);
      roads.push(road);
    });
    P.forEach(([x, y]) => {
      const c = el("circle", { cx: x, cy: y, r: 11, class: "city" });
      map.appendChild(c);
      cities.push(c);
    });
    for (let i = 0; i < 9; i++) {
      const x = 4 + (i % 3) * 50;
      const y = 4 + Math.floor(i / 3) * 50;
      const r = el("rect", { x, y, width: 48, height: 48, rx: 6, class: "sq" });
      const t = el("text", { x: x + 24, y: y + 24, class: "sq-num" });
      t.textContent = String(J.MAGIC[i] + 1);
      secret.appendChild(r);
      secret.appendChild(t);
      squares.push(r);
      numbers.push(t);
    }
  }

  const owner = (i) => (game.you & J.bit(i) ? "you" : game.computer & J.bit(i) ? "computer" : "");

  function render() {
    for (let i = 0; i < 9; i++) {
      const o = owner(i);
      roads[i].setAttribute("class", "road" + (o ? " " + o : ""));
      squares[i].setAttribute("class", "sq" + (o ? " " + o : ""));
      numbers[i].setAttribute("class", "sq-num" + (o ? " taken" : ""));
      const through = J.CITY_LINE.filter((l) => l & J.bit(i)).length;
      hits[i].setAttribute("aria-label", `Road through ${through} cities (tic-tac-toe: ${ROW_NAMES[i]}): ${o ? (o === "you" ? "yours" : "the computer's") : "free"}`);
    }
    J.CITY_LINE.forEach((line, k) => {
      const who = (game.you & line) === line ? "you" : (game.computer & line) === line ? "computer" : "";
      cities[k].setAttribute("class", "city" + (who ? " " + who : ""));
    });
    map.classList.toggle("over", game.over);
    scoreEl.textContent = `Computer ${score.computer} : You ${score.you}`;
    startBtn.disabled = !firstInput.checked || game.you !== 0 || game.computer !== 0;
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  function announce() {
    if (!game.over) return;
    if (game.result === "computer") {
      score.computer++;
      say(`I won! It's now ${score.computer}:${score.you}.`, "lose");
    } else if (game.result === "you") {
      score.you++;
      say(`Congratulations! You won! It's now ${score.computer}:${score.you}.`, "win");
    } else {
      say("Stalemate... Let's try again.", "");
    }
  }

  function claim(i) {
    if (game.over) return;
    if (firstInput.checked && game.computer === 0) {
      say("Press Start to let the computer open.", "");
      return;
    }
    if (!J.free(game, i)) {
      say("That road is taken.", "");
      return;
    }
    J.playYou(game, i);
    say("", "");
    announce();
    render();
  }

  function clear() {
    game = J.start();
    say(firstInput.checked ? "Press Start for the computer's first move." : "Your move: click a road.", "");
    render();
  }

  firstInput.addEventListener("change", clear);
  startBtn.addEventListener("click", () => {
    if (game.you || game.computer) return;
    J.computerOpens(game);
    say("Your move.", "");
    render();
  });
  clearBtn.addEventListener("click", clear);
  secretInput.addEventListener("change", () => stage.classList.toggle("reveal", secretInput.checked));

  build();
  clear();
})();
