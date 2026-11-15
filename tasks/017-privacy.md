---
id: "017"
title: Privacy page and data controls
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["010"]
offline: no
files:
  - privacy/**
  - profile/index.html
  - assets/site.js
  - porting/lint-page.mjs
verify: NODE_PATH=$(npm root -g) node porting/smoke-test.mjs privacy
---

The site is written for young players. A plain-words privacy page (what is kept, where, how to delete it), linked from the footer; account deletion and data export on the profile; a scheduled purge of anonymous accounts idle for 30 days. Public profiles stay off by default and handle-only.

## Outcome

`privacy/` says in plain words what is kept, where, who can see it and how to remove it; the footer of every page links to it. The profile has **Download my record**, which saves progress, plays and the saved position as one file, for guests and signed-in players alike. Deleting the account was already there (task 010).

The scheduled purge of idle anonymous accounts was dropped: there are no anonymous accounts, since guests are never given one.

The page describes what the code does. It has not been checked by a lawyer against the rules for children's data (such as COPPA or the GDPR), which the site's owner should arrange before promoting sign-in to children.
