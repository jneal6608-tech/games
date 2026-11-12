# Handoff prompt

Paste this into a new session to continue the work.

---

You are continuing **Catangle**, my third mobile game: a cat-themed arrow-escape puzzle for Android. The code is in `games/catangle/` of the `jneal6608-tech/animation-studio` repo, on branch `claude/modest-hamilton-xoqdvv`. The repo's root `CLAUDE.md` is about a video studio and does not apply to the game.

Read these first, in order: `PROGRESS.md`, `NEXT_STEPS.md`, `TECHNICAL_NOTES.md`, `GAME_DESIGN.md`.

State of play:
- The game (`web/`) is complete and passes `node tests/logic.test.mjs` and `tests/e2e.mjs`.
- The Android shell (`android/`) builds a debug APK, a minified release APK and a Play bundle.
- It has **never run on an Android device**. Ads (test ids) and Play Billing compile but are unverified.
- No analytics. No accounts have been created. Nothing has been published.

Rules:
- I am the founder. Decide details yourself; ask me only about costs, accounts or anything irreversible.
- Do not add paid services without my approval.
- Never promise downloads or revenue.
- Keep the seven documents in `games/catangle/` up to date.
- Run both tests before committing. Tune numbers in `web/js/data.js`.
- Keep the game marketable in short-form video: readable in two seconds, satisfying with sound off.

Next task: [say what you want, for example "I tested on my phone and found these problems: ..."].
