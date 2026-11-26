"use strict";

/*
 * The page for Voting. voting-core.js holds all four counting methods; this
 * file only draws the preference schedule, takes the clicks and keys, and
 * prints the computation in the order the applet showed it. Each cell of the
 * schedule is a real button: click it (or press arrows) to move a name up or
 * down its ballot. The results area and #status are aria-live.
 */

(function () {
  const Core = VotingCore;
  const stageEl = document.getElementById("stage");
  const scheduleEl = document.getElementById("schedule");
  const outputEl = document.getElementById("output");
  const statusEl = document.getElementById("status");
  const methodIn = document.getElementById("methodIn");
  const namesIn = document.getElementById("namesIn");
  const pickIn = document.getElementById("pickIn");
  const pairA = document.getElementById("pairA");
  const pairB = document.getElementById("pairB");
  const candOut = document.getElementById("candOut");
  const ballotOut = document.getElementById("ballotOut");
  const pickWrap = document.getElementById("pickWrap");
  const elimWrap = document.getElementById("elimWrap");
  const pairWrap = document.getElementById("pairWrap");
  const elimBtn = document.getElementById("elimBtn");

  let state = Core.start();

  const LABEL = {
    plurality: "Plurality",
    borda: "Borda",
    elimination: "Plurality with elimination",
    pairwise: "Pairwise comparison",
  };
  const ordinal = (r) => ["1st", "2nd", "3rd"][r] || `${r + 1}th`;
  const points = (v) => Number.isInteger(v) ? `${v}.0` : String(v);
  const pairKey = (a, b) => (a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /** A line under the game. The three kinds are also the record's finish flags. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function hint() {
    const n = state.candidates.length;
    if (state.method === "plurality" || state.method === "borda") {
      return `${LABEL[state.method]}: ${state.revealed.length} of ${n} scores shown. Pick a candidate to look at its score.`;
    }
    if (state.method === "elimination") {
      return Core.result(state) === "done"
        ? "Round finished. Press Restore to retrace the eliminations."
        : `Round ${state.round + 1}: press Eliminate weakest candidate.`;
    }
    return `${state.comparisons.length} of ${Core.pairCount(state)} pairs compared. Pick two different candidates.`;
  }

  /* ------------------------------------------------------- the schedule table */

  function renderSchedule() {
    const focused = document.activeElement;
    const keep = focused && focused.dataset
      ? { name: focused.dataset.name, ballot: focused.dataset.ballot, count: focused.dataset.count }
      : {};
    const table = el("table");
    table.id = "schedule";
    const caption = el("caption", "", "Each column is one ballot. The number on top says how many voters cast it.");
    table.appendChild(caption);

    const head = el("thead"), topRow = el("tr");
    topRow.appendChild(el("th", "", "Rank"));
    state.ballots.forEach((b, i) => {
      const th = el("th", "", `Ballot ${i + 1}`);
      th.scope = "col";
      topRow.appendChild(th);
    });
    head.appendChild(topRow);
    const countRow = el("tr");
    countRow.appendChild(el("th", "", "Voters"));
    state.ballots.forEach((b, i) => {
      const td = el("td");
      const input = el("input", "count");
      input.type = "number";
      input.min = String(Core.RANGE.voters[0]);
      input.max = String(Core.RANGE.voters[1]);
      input.step = "1";
      input.value = String(b.count);
      input.dataset.count = String(i);
      input.setAttribute("aria-label", `Voters on ballot ${i + 1}`);
      input.addEventListener("change", () => play({ type: "count", ballot: i, value: Number(input.value) }));
      td.appendChild(input);
      countRow.appendChild(td);
    });
    head.appendChild(countRow);
    table.appendChild(head);

    const round = state.method === "elimination" ? Core.eliminationRound(state) : null;
    const body = el("tbody");
    for (let r = 0; r < state.candidates.length; r++) {
      const row = el("tr");
      const label = el("th", "rank", ordinal(r));
      label.scope = "row";
      row.appendChild(label);
      state.ballots.forEach((b, i) => {
        const name = b.order[r];
        const button = el("button", "cell" + (round && round.weakest === name && round.active.length > 2 ? " weak" : ""), name);
        button.type = "button";
        button.dataset.name = name;
        button.dataset.ballot = String(i);
        button.dataset.rank = String(r);
        button.setAttribute("aria-label", `Ballot ${i + 1}, ${ordinal(r)} place: ${name}. Press to move up, down arrow to move down.`);
        button.addEventListener("click", () => play({ type: "swap", ballot: i, index: r }));
        button.addEventListener("keydown", (e) => {
          if (e.key === "ArrowUp" && r > 0) { e.preventDefault(); play({ type: "swap", ballot: i, index: r }); }
          else if (e.key === "ArrowDown" && r < state.candidates.length - 1) { e.preventDefault(); play({ type: "swap", ballot: i, index: r + 1 }); }
        });
        row.appendChild(button);
      });
      body.appendChild(row);
    }
    table.appendChild(body);
    scheduleEl.replaceChildren(table);

    let restore = null;
    if (keep.name !== undefined) restore = scheduleEl.querySelector(`button[data-name="${CSS.escape(keep.name)}"][data-ballot="${keep.ballot}"]`);
    else if (keep.count !== undefined) restore = scheduleEl.querySelector(`input[data-count="${keep.count}"]`);
    if (restore) restore.focus();
  }

  /* --------------------------------------------------------------- the output */

  function line(text, cls) { outputEl.appendChild(el("div", cls || "line", text)); }
  const blank = () => line("\u00a0", "line blank");

  function renderOutput() {
    outputEl.replaceChildren();
    if (state.method === "plurality" || state.method === "borda") {
      state.revealed.forEach((name) => line(Core.scoreLine(state, name, state.method)));
      const done = Core.result(state) === "done";
      if (done) {
        blank();
        line("Sorted results:", "caption");
        const scores = Core.scores(state);
        Core.ranked(scores, state.revealed).forEach((name) => line(`${name}: ${scores[name]} first place votes`));
      }
    } else if (state.method === "elimination") {
      const rounds = Core.eliminationRounds(state);
      rounds.slice(0, state.round).forEach((r) => {
        line(`Round ${r.number}`, "caption");
        r.ranked.forEach((name) => line(`${name}: ${r.scores[name]} first place votes`));
        if (r.winner === undefined) line(`Weakest: ${r.weakest}`, "weak-text");
        else if (r.winner === null) { blank(); line("Tied elections", "caption"); line("nobody"); }
        else { blank(); line("You got a winner", "caption"); line(r.winner, "winner"); }
        if (r.number < state.round) blank();
      });
    } else {
      const duels = Core.pairwise(state).duels;
      state.comparisons.forEach((pair) => {
        const d = duels.find((x) => pairKey(x.a, x.b) === pairKey(pair[0], pair[1]));
        line(`${d.a} vs ${d.b}: ${d.forA} votes to ${d.forB} votes`);
        if (d.award === null) line(`${d.a} and ${d.b} both get .5 point`, "sub");
        else line(`${d.award} gets 1 point`, "sub");
      });
      if (Core.result(state) === "done") {
        blank();
        line("Sorted results:", "caption");
        const scores = Core.scores(state);
        Core.ranked(scores, Core.hashtableOrder(state.candidates)).forEach((name) => line(`${name} ${points(scores[name])} points`));
      }
    }
  }

  /* --------------------------------------------------------------- the render */

  function fillSelect(select, current) {
    select.replaceChildren();
    state.candidates.forEach((name) => {
      const option = el("option", "", name);
      option.value = name;
      select.appendChild(option);
    });
    if (current && state.candidates.includes(current)) select.value = current;
  }

  function render() {
    renderSchedule();
    candOut.textContent = String(state.candidates.length);
    ballotOut.textContent = String(state.ballots.length);
    if (namesIn.value !== state.namesText && document.activeElement !== namesIn) namesIn.value = state.namesText;
    methodIn.value = state.method;
    pickWrap.hidden = !(state.method === "plurality" || state.method === "borda");
    elimWrap.hidden = state.method !== "elimination";
    pairWrap.hidden = state.method !== "pairwise";
    if (!pickWrap.hidden) fillSelect(pickIn, pickIn.value);
    if (!pairWrap.hidden) {
      fillSelect(pairA, pairA.value);
      fillSelect(pairB, pairB.value);
      if (pairA.value === pairB.value && state.candidates.length > 1) {
        pairB.value = state.candidates[(state.candidates.indexOf(pairA.value) + 1) % state.candidates.length];
      }
    }
    elimBtn.textContent = Core.result(state) === "done" ? "Restore" : "Eliminate weakest candidate";
    renderOutput();

    if (Core.result(state) === "done") {
      const winners = Core.winners(state);
      const message = winners.length === 1
        ? `${winners[0]} wins by ${LABEL[state.method].toLowerCase()}.`
        : `Tied elections: ${winners.join(" and ")}.`;
      say(`${message} Change a count or pick another method to try again.`, "done");
    } else {
      say(hint());
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(m) {
    const next = Core.move(state, m);
    if (!next) {
      if (m && m.type === "compare" && m.a === m.b) say("Select two different candidates");
      else if (m && m.type === "compare") say("Those two have already been compared");
      else if (m && m.type === "reveal") say("That score is already on the board");
      else if (m && m.type === "swap") say("That name is already first; use the down arrow to move it");
      else say("Check the number you typed");
      return;
    }
    state = next;
    render();
  }

  /* ------------------------------------------------------------- the controls */

  document.getElementById("candLess").addEventListener("click", () => play({ type: "candidates", n: state.candidates.length - 1 }));
  document.getElementById("candMore").addEventListener("click", () => play({ type: "candidates", n: state.candidates.length + 1 }));
  document.getElementById("ballotLess").addEventListener("click", () => play({ type: "ballots", n: state.ballots.length - 1 }));
  document.getElementById("ballotMore").addEventListener("click", () => play({ type: "ballots", n: state.ballots.length + 1 }));
  document.getElementById("readNamesBtn").addEventListener("click", () => {
    if (Core.move(state, { type: "names", text: namesIn.value })) play({ type: "names", text: namesIn.value });
    else say("Type 2 to 40 different names, separated by commas");
  });
  namesIn.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("readNamesBtn").click(); });
  methodIn.addEventListener("change", () => play({ type: "method", method: methodIn.value }));
  document.getElementById("revealBtn").addEventListener("click", () => play({ type: "reveal", name: pickIn.value }));
  elimBtn.addEventListener("click", () => play({ type: "eliminate" }));
  document.getElementById("compareBtn").addEventListener("click", () => play({ type: "compare", a: pairA.value, b: pairB.value }));
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.start({ method: state.method });
    namesIn.value = state.namesText;
    render();
  });

  render();
})();
