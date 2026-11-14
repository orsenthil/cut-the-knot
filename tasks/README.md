# Tasks

Work on accounts, profiles and the personal tutor, cut so that several people
or agents can work at once without touching the same files. The overall
design is in [docs/contracts.md](../docs/contracts.md).

Porting applets is not tracked here: `porting/manifest.json` is that queue,
and `porting/README.md` is its routine.

## Picking a task

```sh
node tasks/next.mjs            # the tasks you can start now
node tasks/next.mjs --offline  # only those that need no network or accounts
node tasks/next.mjs --all      # everything, with status
```

A task can start when its `status` is `todo` and every task in `deps` is
`done`.

1. **Claim it.** Set `status: claimed`, `owner` and `claimedAt` in the task
   file, and commit and push that change alone. Working offline, commit the
   claim locally; it lands with your first push. If someone else's claim got
   there first, pick another task.
2. **Stay inside `files`.** Those are the only paths the task may change.
   Needing another path means the task was cut wrong: say so in the task
   file rather than reaching across.
3. **Finish.** `verify` must pass. Set `status: done`, add a line or two
   under "Outcome" saying what was built and anything the next person should
   know, and commit.

A claim older than a day with no commits is stale and may be taken over.

## Format

```
---
id: "008"
title: Short name
status: todo | claimed | done
owner:
claimedAt:
deps: ["000"]
offline: yes | no | partly
files:
  - path/or/glob
verify: the command that must pass
---
What to build, and why. Links to the contract sections it implements.
```

`offline: yes` means the task needs nothing but this repository and its
installed tools. `human` in `owner` marks setup only the site's owner can do
(creating cloud projects, secrets, DNS).
