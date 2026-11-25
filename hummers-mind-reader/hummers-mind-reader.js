"use strict";

/*
 * The page for Hummer's Mind Reader: drawing and input only. Three coin buttons
 * in the places the applet's coins occupy; clicking two coins swaps them. The
 * rules are in hummers-mind-reader-core.js.
 */

(function () {
  const Core = HummersCore;
  const row = document.getElementById("row");
  const say = document.getElementById("say");
  const statusEl = document.getElementById("status");
  const useNumbers = document.getElementById("useNumbers");
  const SRC = ["images/Penny.gif", "images/Nickel.gif", "images/Dime.gif"];
  const SIZE = [[66, 65], [75, 75], [62, 62]];

  let state = Core.start();
  const buttons = [0, 1, 2].map((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "coin";
    b.addEventListener("click", () => { const s = Core.click(state, c); if (s) { state = s; render(); } });
    return b;
  });

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function face(coin) {
    if (useNumbers.checked) return document.createTextNode(String(coin + 1));
    const img = document.createElement("img");
    img.src = SRC[coin]; img.alt = ""; img.width = SIZE[coin][0]; img.height = SIZE[coin][1];
    return img;
  }

  function render() {
    // the coin in place 0, then 1, then 2
    const inPlace = [0, 1, 2].map((p) => state.pos.indexOf(p));
    row.textContent = "";
    inPlace.forEach((c, p) => {
      const b = buttons[c];
      b.textContent = ""; b.appendChild(face(c));
      b.classList.toggle("sel", state.selected.includes(c));
      b.disabled = !!state.announcement;
      b.setAttribute("aria-pressed", state.selected.includes(c) ? "true" : "false");
      b.setAttribute("aria-label", `Place ${p + 1}: the ${useNumbers.checked ? "number " + (c + 1) : Core.NAMES[c]}. Press two coins to swap them.`);
      row.appendChild(b);
    });
    say.textContent = "";
    if (state.announcement) {
      say.append(state.announcement.line1);
      const second = document.createElement("span"); second.className = "big"; second.textContent = state.announcement.line2; say.appendChild(second);
    }
    if (window.Track) window.Track.state(state);
  }

  document.getElementById("announceBtn").addEventListener("click", () => {
    const s = Core.announce(state, useNumbers.checked);
    if (!s) return;
    state = s; render();
    if (Core.result(state) === "done") setStatus(state.announcement.line1, "done"); else setStatus(state.announcement.line1 + " " + state.announcement.line2);
    // keep the keyboard on the Announce button
  });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); setStatus(""); render(); });
  [document.getElementById("useCoins"), useNumbers].forEach((r) => r.addEventListener("change", render));
  render();
})();
