---
id: "017"
title: Privacy page and data controls
status: todo
owner: 
claimedAt: 
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
