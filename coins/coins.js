"use strict";

/*
 * Browser UI for the Coin Game (port of Coins.jar / CoinsCanvas.java and
 * CoinsPanel.java). Game rules and the computer's strategy live in
 * coin-game.js. Coins are laid out on a circle: for a row, one slot is left
 * empty so the ring stays open; for a loop, all slots are filled.
 */

const STAGE_W = 500;
const STAGE_H = 350;
const US_COINS = [
  { value: 1, src: "images/Penny.gif", w: 66, h: 65 },
  { value: 5, src: "images/Nickel.gif", w: 75, h: 75 },
  { value: 10, src: "images/Dime.gif", w: 62, h: 62 },
  { value: 25, src: "images/Quarter.gif", w: 88, h: 86 },
];
const TICK_STEPS = 50;
const TICK_MS = 30;

const stage = document.getElementById("stage");
const tickerEl = document.getElementById("ticker");
const tickerCells = document.getElementById("tickerCells");
const tickerCaption = document.getElementById("tickerCaption");
const hintEl = document.getElementById("hint");
const nInput = document.getElementById("nInput");
const moveBtn = document.getElementById("moveBtn");
const resetBtn = document.getElementById("resetBtn");
const repeatBtn = document.getElementById("repeatBtn");
const loopBox = document.getElementById("loopBox");
const scoresBox = document.getElementById("scoresBox");
const scoreYou = document.getElementById("scoreYou");
const scoreMe = document.getElementById("scoreMe");

for (let i = 0; i < TICK_STEPS; i++) {
  const cell = document.createElement("span");
  cell.className = "cell";
  tickerCells.appendChild(cell);
}

let game = null;
let buttons = [];
let busy = false;
let over = false;
let tickToken = 0;

function settings() {
  const n = Math.min(20, Math.max(2, parseInt(nInput.value, 10) || 6));
  nInput.value = n;
  return {
    n,
    loop: loopBox.checked,
    useCoins: document.querySelector('input[name="use"]:checked').value === "coins",
  };
}

// ---- ticker (the animated "Thinking ..." bar) ----

function setTicker(caption, progress) {
  tickerCaption.textContent = caption;
  const cells = tickerCells.children;
  for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("on", i < progress);
}

function runTicker(caption, onDone) {
  const token = ++tickToken;
  let step = 0;
  setTicker(caption, 0);
  const timer = setInterval(() => {
    if (token !== tickToken) {
      clearInterval(timer);
      return;
    }
    step++;
    if (step <= TICK_STEPS) {
      setTicker(caption, step);
    } else {
      clearInterval(timer);
      setTicker("", 0);
      onDone();
    }
  }, TICK_MS);
}

function stopTicker() {
  tickToken++;
  setTicker("", 0);
}

// ---- board ----

function buildCoins(s) {
  const coins = [];
  for (let i = 0; i < s.n; i++) {
    const kind = Math.floor(Math.random() * 4);
    const coin = new Coin(s.useCoins ? US_COINS[kind].value : Math.floor(Math.random() * 9), i);
    coin.kind = kind;
    coins.push(coin);
  }
  return coins;
}

function layout(s) {
  const slots = s.loop ? s.n : s.n + 1;
  const step = (Math.PI * 2) / slots;
  const cx = Math.floor(STAGE_W / 2);
  const cy = Math.floor(STAGE_H / 2);
  const ring = Math.min(STAGE_W, STAGE_H) / 2.6;
  const numberRadius = Math.floor(Math.min((Math.PI * ring) / slots, ring / 3));
  return { step, cx, cy, ring, numberRadius };
}

function pct(v, total) {
  return (v / total) * 100 + "%";
}

function buildStage(s) {
  stage.querySelectorAll(".coin").forEach((b) => b.remove());
  buttons = [];
  const geo = layout(s);
  game.coins.forEach((coin) => {
    const x = Math.floor(geo.cx + geo.ring * Math.cos(coin.index * geo.step));
    const y = Math.floor(geo.cy + geo.ring * Math.sin(coin.index * geo.step));
    const b = document.createElement("button");
    b.type = "button";
    b.className = "coin";
    b.style.left = pct(x, STAGE_W);
    b.style.top = pct(y, STAGE_H);
    // lower-numbered coins sit on top where they overlap, like the original hit-testing
    b.style.zIndex = String(s.n - coin.index);
    if (s.useCoins) {
      const c = US_COINS[coin.kind];
      const radius = Math.floor(Math.min(c.w, c.h) / 2) + 1;
      b.style.width = pct(2 * radius, STAGE_W);
      const img = document.createElement("img");
      img.src = c.src;
      img.alt = "";
      img.style.width = (c.w / (2 * radius)) * 100 + "%";
      b.appendChild(img);
      b.setAttribute("aria-label", `Coin ${coin.index + 1} of ${s.n}: ${coin.value} cents`);
    } else {
      b.classList.add("number");
      b.style.width = pct(2 * geo.numberRadius, STAGE_W);
      b.textContent = String(coin.value);
      b.setAttribute("aria-label", `Coin ${coin.index + 1} of ${s.n}: worth ${coin.value}`);
    }
    b.addEventListener("click", () => onCoinClick(coin));
    stage.appendChild(b);
    buttons.push(b);
  });
  refresh();
}

function refresh() {
  game.coins.forEach((coin, i) => {
    const b = buttons[i];
    b.classList.toggle("gone", !coin.enabled);
    b.classList.toggle("end", !over && !busy && game.isTakeable(coin));
    b.tabIndex = coin.enabled ? 0 : -1;
  });
  scoreYou.hidden = scoreMe.hidden = !scoresBox.checked;
  scoreYou.innerHTML = `Your Score<br>${game.scores.x}`;
  scoreMe.innerHTML = `My Score<br>${game.scores.y}`;
  const started = game.coins.some((c) => !c.enabled);
  moveBtn.disabled = busy || over || started;
  stage.classList.toggle("busy", busy);
}

function newGame() {
  const s = settings();
  stopTicker();
  busy = false;
  over = false;
  game = new CoinGame(buildCoins(s), s.loop);
  hintEl.textContent = "";
  buildStage(s);
}

function repeatGame() {
  stopTicker();
  busy = false;
  over = false;
  game.renew();
  hintEl.textContent = "";
  refresh();
}

// ---- turns ----

function onCoinClick(coin) {
  if (busy || over) return;
  const result = game.humanTake(coin);
  if (result === "illegal") {
    busy = true;
    refresh();
    runTicker("Illegal Move", () => {
      busy = false;
      refresh();
    });
  } else if (result === "taken") {
    forceMove();
  }
}

function forceMove() {
  if (game.isFinished()) {
    declareWinner();
    return;
  }
  busy = true;
  refresh();
  runTicker("Thinking ...", () => {
    game.computerPlay();
    busy = false;
    if (game.isFinished()) declareWinner();
    else refresh();
  });
}

function declareWinner() {
  over = true;
  busy = false;
  const p = game.countPoints();
  const caption = p.x > p.y ? "You won" : p.x < p.y ? "I won" : "It's a draw";
  setTicker(caption, TICK_STEPS);
  hintEl.textContent = `You ${p.x} – ${p.y} me. Press Reset for new coins, or Repeat to replay these.`;
  refresh();
}

// ---- controls ----

moveBtn.addEventListener("click", () => {
  if (!busy && !over) forceMove();
});
resetBtn.addEventListener("click", newGame);
repeatBtn.addEventListener("click", repeatGame);
nInput.addEventListener("change", newGame);
loopBox.addEventListener("change", newGame);
for (const r of document.querySelectorAll('input[name="use"]')) r.addEventListener("change", newGame);
scoresBox.addEventListener("change", refresh);

newGame();
