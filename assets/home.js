"use strict";

/*
 * The home page: the catalogue as cards, and the ways to narrow it down.
 *
 * It is written for a catalogue of a thousand or more:
 *
 *   - Three ways to find a game, which combine: a search box (words in the
 *     title, the blurb or an idea's name), how hard ("Start here" is where a
 *     new player should begin), and one idea from the tag bar.
 *   - Only the first PAGE cards are put on the page; "Show more games" adds
 *     the next PAGE. A long list is never built in one go.
 *   - The tag bar shows the most used ideas, and the rest on request.
 *
 * What is chosen lives in the address, so a view can be linked to and the
 * back button works: the idea is the #hash (as game pages link to it), the
 * search and the level are ?q= and ?level=.
 *
 * Loaded with defer, after games.js, concepts.js, recommend.js and
 * progress.js.
 */

(function () {
  const PAGE = 48;
  const TAGS_SHOWN = 14;
  /** Cards after this many are laid out only when near the screen. */
  const DEFER_AFTER = 12;

  const { games, tags } = window.COOLMATHS;
  const { tagLabel } = window.COOLMATHS_SITE;
  const filtersEl = document.getElementById("filters");
  const headingEl = document.getElementById("heading");
  const gridEl = document.getElementById("grid");
  const moreEl = document.getElementById("more");
  const searchEl = document.getElementById("q");
  const levelButtons = [...document.querySelectorAll("#levels button")];

  /** What each game can be found by, lower-cased once. */
  const haystack = new Map(
    games.map((g) => [g, `${g.title} ${g.blurb} ${g.tags.map(tagLabel).join(" ")} ${g.tags.join(" ")}`.toLowerCase()]),
  );
  const countFor = (tag) => games.filter((g) => g.tags.includes(tag)).length;
  const tagsByUse = Object.keys(tags)
    .filter((t) => countFor(t) > 0)
    .sort((a, b) => countFor(b) - countFor(a) || tagLabel(a).localeCompare(tagLabel(b)));

  let shown = PAGE;
  let allTags = false;

  /* ------------------------------------------------------------ the choice */

  function choice() {
    const params = new URLSearchParams(location.search);
    return {
      tag: decodeURIComponent(location.hash.replace(/^#\/?/, "")).trim().toLowerCase(),
      query: (params.get("q") || "").trim(),
      level: ["1", "2", "3"].includes(params.get("level")) ? Number(params.get("level")) : null,
    };
  }

  /** Changes ?q= or ?level= without adding a step to the back button. */
  function setParam(name, value) {
    const params = new URLSearchParams(location.search);
    if (value) params.set(name, value);
    else params.delete(name);
    const search = params.toString();
    history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
    shown = PAGE;
    render();
  }

  function matching({ tag, query, level }) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return games.filter(
      (g) =>
        (!tag || g.tags.includes(tag)) &&
        (!level || g.level === level) &&
        words.every((word) => haystack.get(g).includes(word)),
    );
  }

  /* ------------------------------------------------------------- rendering */

  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderFilters(active) {
    filtersEl.textContent = "";
    const all = node("a", "", "All ideas");
    all.href = "#";
    all.setAttribute("aria-current", String(!active));
    filtersEl.appendChild(all);

    const visible = allTags ? tagsByUse : tagsByUse.slice(0, TAGS_SHOWN);
    // The chosen idea is always shown, even when it is not among the most used.
    if (active && tagsByUse.includes(active) && !visible.includes(active)) visible.push(active);
    for (const t of visible) {
      const a = node("a");
      a.href = "#" + t;
      a.append(tagLabel(t), node("span", "count", String(countFor(t))));
      a.setAttribute("aria-current", String(active === t));
      filtersEl.appendChild(a);
    }

    if (tagsByUse.length > TAGS_SHOWN) {
      const toggle = node("button", "", allTags ? "Fewer ideas" : `All ${tagsByUse.length} ideas`);
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", String(allTags));
      toggle.addEventListener("click", () => {
        allTags = !allTags;
        renderFilters(choice().tag);
        filtersEl.querySelector("button").focus();
      });
      filtersEl.appendChild(toggle);
    }
  }

  function card(game, index) {
    const li = node("li", index >= DEFER_AFTER ? "later" : "");
    const article = node("article", "card");

    const img = node("img");
    img.src = `${game.slug}/thumb.svg`;
    img.alt = "";
    img.width = 320;
    img.height = 200;
    img.decoding = "async";
    // The first cards may be on screen at once; the rest wait until they are near.
    if (index >= 4) img.loading = "lazy";

    const h2 = node("h2");
    const link = node("a", "card-link", game.title);
    link.href = `${game.slug}/index.html`;
    h2.appendChild(link);

    const footer = node("footer");
    if (game.level === 1) footer.appendChild(node("span", "badge start", "Start here"));
    if (game.level === 3) footer.appendChild(node("span", "badge", "Tricky"));
    if (game.kind === "demo") footer.appendChild(node("span", "badge", "Explore"));
    for (const t of game.tags) {
      const a = node("a", "tag", tagLabel(t));
      a.href = "#" + t;
      footer.appendChild(a);
    }

    article.append(img, h2, node("p", "", game.blurb), footer);
    li.appendChild(article);
    return li;
  }

  function describe(count, { tag, query, level }) {
    const parts = [];
    if (tag) parts.push(tagLabel(tag));
    if (level) parts.push(levelButtons.find((b) => Number(b.dataset.level) === level).textContent);
    if (query) parts.push(`“${query}”`);
    const games = `${count} ${count === 1 ? "game" : "games"}`;
    headingEl.textContent = "";
    if (parts.length === 0) {
      headingEl.textContent = games;
    } else {
      headingEl.append(node("strong", "", parts.join(" · ")), ` · ${games}`);
    }
  }

  function render() {
    const picked = choice();
    const list = matching(picked);

    renderFilters(picked.tag);
    if (searchEl.value !== picked.query && document.activeElement !== searchEl) searchEl.value = picked.query;
    for (const b of levelButtons) b.setAttribute("aria-pressed", String((Number(b.dataset.level) || null) === picked.level));
    describe(list.length, picked);

    gridEl.textContent = "";
    if (list.length === 0) {
      const empty = node("li", "empty", "No games match that yet. ");
      const reset = node("a", "", "See all games");
      reset.href = location.pathname;
      empty.appendChild(reset);
      gridEl.appendChild(empty);
    } else {
      const fragment = document.createDocumentFragment();
      list.slice(0, shown).forEach((g, i) => fragment.appendChild(card(g, i)));
      gridEl.appendChild(fragment);
    }

    const left = list.length - shown;
    moreEl.hidden = left <= 0;
    if (left > 0) moreEl.textContent = `Show ${Math.min(PAGE, left)} more games`;
  }

  /* --------------------------------------------------------------- events */

  let typing = null;
  searchEl.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(() => setParam("q", searchEl.value.trim()), 150);
  });
  for (const b of levelButtons) b.addEventListener("click", () => setParam("level", b.dataset.level));

  moreEl.addEventListener("click", () => {
    const first = shown; // the first of the new cards gets the focus
    shown += PAGE;
    render();
    const next = gridEl.children[first];
    if (next) next.querySelector("a.card-link").focus();
  });

  window.addEventListener("hashchange", () => {
    shown = PAGE;
    render();
    if (choice().tag) filtersEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  window.addEventListener("popstate", render);

  searchEl.value = choice().query;
  render();

  /* --------------------------------------- what to play next, once there is a record */

  async function suggestNext() {
    const line = document.getElementById("forYou");
    const progress = await Track.progress();
    const [pick] = Object.keys(progress).length ? Recommend.next(progress, games, window.COOLMATHS_CONCEPTS, 1) : [];
    line.textContent = "";
    line.hidden = !pick;
    if (!pick) return;

    const link = node("a", "", pick.game.title);
    link.href = `${pick.game.slug}/index.html`;
    const profile = node("a", "", "Your profile");
    profile.href = "profile/index.html";
    line.append("Next for you: ", link, `. ${Recommend.explain(pick, tagLabel)} `, profile);
  }

  // The record can arrive late: a signed-in player's comes from their account.
  window.addEventListener("progresschange", suggestNext);
  suggestNext();
})();
