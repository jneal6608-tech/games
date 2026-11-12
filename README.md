# Games

Five mobile games (Android). Each folder is self-contained and has its own docs and build instructions.

| Game | What it is |
|---|---|
| [Lurelight](lurelight/) | Arcade survival roguelite: an anglerfish whirls its glowing lure through deep-sea swarms (Godot). |
| [Fuseworks](fuseworks/) | Portrait puzzle roguelike: build a firework display, light one fuse, watch the sky chain-react. |
| [Catangle](catangle/) | Cat-themed escape puzzle: tap a cat with a clear path and it runs home. |
| [Emberhold](emberhold/) | Idle roguelite defense: keep the last campfire alight against waves of shades. |
| [Brewfall](brewfall/) | Merge roguelite: drop essences into a cauldron, merge them, and buy charms that bend the scoring. |

Release status for all five: [MASTER_RELEASE_REPORT.md](MASTER_RELEASE_REPORT.md). Each game folder has a `RELEASE_CHECKLIST.md`.

## Launch guide

In Claude Code, run `/gamelaunch` (optionally with a game folder or an `.apk` path, e.g. `/gamelaunch catangle`) for a
step-by-step, one-step-at-a-time guide from "I have an APK" to "the game is live". It inspects the APK, explains why
Google Play needs an `.aab`, walks through accounts, policies, testing tracks and other stores, and keeps a
`LAUNCH_PROGRESS.md` so you can stop and resume. The command lives in `.claude/commands/gamelaunch.md`.
