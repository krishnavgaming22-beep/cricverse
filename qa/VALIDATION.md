# CricVerse 1.1 validation — 27 October 2026

## Executed checks

- `npm test`: **30 tests passed** across four files. Includes 1,200 seeded deliveries, rules, extras/free hits, catches, running/run-outs, match endings and replay state.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run verify:assets`: all eight GLBs passed header, mesh/UV and source-file checks; three player assets contain skins and the named rest-pose clip inventory.
- Six production Playwright flows passed: match/pause/settings/restart; practice contact/run input/replay; worker lab/export; narrow settings; live aim and commitment; rendered grip checks across six stages.
- Additional six-legal-delivery browser playthrough records the real ledger in `rescue/full-over.json`.
- Motion inspection screenshots were captured from the actual game renderer at idle, backswing, contact, follow-through, extension and recovery. These show pose stages, not claims of simultaneous ball impact.

## Measurements

The reachable-envelope audit sampled 4,896 poses across all four strokes, two lines, four ball heights and three aim angles. Maximum palm-to-grip error was 0.00000201 m; the lowest blade toe was 0.0361 m above the pitch. Socket alignment alone does not establish natural anatomy, so the rendered comparisons were inspected as well.

At 100 km/h with zero seam/swing, measured first-bounce Z coordinates were 8.102 m (yorker), 6.043 m (full), 3.529 m (good), -0.121 m (short) and 3.580 m (slower length). See `rescue/delivery-lengths.json`. These are deterministic test conditions, not a calibration against tracked professional deliveries.

The controller's start and contact tangents are checked for continuity. Static and moving blade tests verify that relative surface velocity changes the outgoing impulse; misses do not produce an impulse. Ground response is checked for axis symmetry and wickets use swept physical stump/bail volumes. Release position equals the actual bowler palm socket.

## Evidence and limits

`rescue/contacts.json` records actual collisions and outcomes; `balance-report.json` records the 1,200-delivery balance batch. `rescue/*-comparison.png`, `gameplay.png`, `ball-in-play.png`, `replay.png` and `lab.png` are browser captures, not concept renders.

The licensed continuous human base and new gloves are real exported Blender assets. Sports animation is a layered runtime controller; the GLB clips are named rest-pose placeholders. Character clothing, body deformation and fielding transitions remain simplified. The implementation does not claim AAA fidelity, mocap, full cricket rules or universal 60 FPS. Two requested YouTube references could not be watched because the browser required sign-in; no claim of matching those videos is made.

Browser checks were executed locally in Chromium with a Metal WebGL backend. GitHub Actions additionally runs physics/rules, asset checks and production compilation. Public-site smoke-test results are reported separately after deployment.
