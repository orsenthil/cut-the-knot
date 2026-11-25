"use strict";

/*
 * The page for The MIU System: drawing and input only. The four rule buttons
 * (with the applet's labels), the list of theorems with the newest on top, and,
 * when rule 3 or 4 could apply in several places, the word with a button at
 * each place where the player picks one. The rules are in miu-system-core.js.
 */

(function () {
  const Core = MIUCore;
  const rulesEl = document.getElementById("rules4");
  const listEl = document.getElementById("list");
  const pickEl = document.getElementById("pick");
  const removeBtn = document.getElementById("removeBtn");
  const statusEl = document.getElementById("status");
  const NAMES = ["Rule 1", "Rule 2", "Rule 3", "Rule 4"];

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const ruleButtons = [1, 2, 3, 4].map((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = "<strong>" + NAMES[r - 1] + "</strong><br>";
    b.append(Core.LABELS[r - 1].replace(/\s+/g, " "));
    b.addEventListener("click", () => { const s = Core.press(state, r); if (s) { state = s; update(r); } });
    rulesEl.appendChild(b);
    return b;
  });

  function update(rule) {
    const av = Core.available(state);
    ruleButtons.forEach((b, i) => { b.disabled = !av.rules[i]; });
    removeBtn.disabled = !av.remove;
    listEl.textContent = "";
    state.theorems.forEach((t, i) => {
      const li = document.createElement("li"); li.textContent = t;
      li.setAttribute("aria-label", `Theorem ${state.theorems.length - i}: ${t}`);
      listEl.appendChild(li);
    });
    pickEl.hidden = !state.pending;
    pickEl.textContent = "";
    if (state.pending) {
      const p = document.createElement("p");
      p.textContent = `Rule ${state.pending.rule} fits in several places. Press the first letter of the ${state.pending.rule === 3 ? "III" : "UU"} you want to use.`;
      pickEl.appendChild(p);
      const places = new Set(Core.places(state.pending.text, state.pending.rule));
      [...state.pending.text].forEach((ch, i) => {
        if (places.has(i)) {
          const b = document.createElement("button");
          b.type = "button"; b.textContent = ch;
          b.setAttribute("aria-label", `Letter ${i + 1}: the start of ${state.pending.rule === 3 ? "III" : "UU"}`);
          const rule = state.pending.rule;
          b.addEventListener("click", () => { const s = Core.choose(state, i); if (s) { state = s; update(rule); } });
          pickEl.appendChild(b);
        } else pickEl.append(ch);
      });
      const c = document.createElement("button");
      c.type = "button"; c.textContent = "Cancel"; c.style.marginLeft = "0.8rem";
      c.style.fontFamily = "system-ui, sans-serif";
      c.addEventListener("click", () => { state = Core.cancel(state); update(); say(""); });
      pickEl.appendChild(c);
      const first = pickEl.querySelector("button"); if (first) first.focus();
    }
    if (rule === 1 || rule === 2 || rule === 3 || rule === 4) { say(`Rule ${rule} gave ${state.theorems[0]}.`); if (!ruleButtons[rule - 1].disabled) ruleButtons[rule - 1].focus(); }
    if (Core.isMU(state)) say("MU! This cannot happen.", "win");
    if (window.Track) window.Track.state({ theorems: state.theorems.slice(0, 40), count: state.theorems.length, top: state.theorems[0] });
  }

  removeBtn.addEventListener("click", () => { const s = Core.removeLast(state); if (s) { state = s; update(); say("The newest word was removed."); } });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); update(); say(""); });
  update();
})();
