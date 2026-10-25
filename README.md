# CRICVERSE — The First Innings

A playable local 3D cricket batting game with original Blender assets, deterministic ball physics, an adaptive bowler, fielding, a complete target chase, practice, and a working simulation lab.

## Play

Requires Node.js 22.12+ (tested with 24.21), npm, and a recent desktop browser with WebGL2.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. If port 5173 is occupied, Vite chooses the next free port. **Quick Match → Take the Crease → Start Innings** starts a 1, 2, or 5-over chase. Three wickets are available. Practice has unlimited deliveries. Click once to enable browser audio.

```sh
npm run build        # TypeScript check + production output in dist/
npm run preview      # Serve the compiled game locally
npm test             # Rules, physics, state, reproducibility and balance tests
npm run test:browser  # Playwright; run npm run build first
npm run verify:assets
```

For the first browser-test run: `npx playwright install chromium`. Browser tests launch the production preview at `http://127.0.0.1:4188`. The existing local development session is independent. The game needs no API, subscription, or network connection after installation: models, textures, fonts, scripts, and generated audio are local.

## Controls

| Input | Action |
|---|---|
| 1 / 2 / 3 / 4 | Defend / grounded drive / lofted drive / pull or cut |
| A / D | Aim left / right |
| Space | Swing; contact develops about 0.18 seconds after input |
| R | Attempt a run while the ball is in play |
| C | Cycle crease, elevated, and cinematic approach cameras |
| Esc | Pause / resume |
| Mouse | Menus, strokes, swing, running, practice controls |

Fuller balls favour drives; short balls favour the pull. Placement matters: a well-timed drive into a fielder can still be a dot. Grounded rope crossings score four; a crossing on the full scores six. An attempted run counts only when both batsmen finish crossing. Returning fielders can run you out. The tutorial and assistance indicators can be disabled in Settings.

## Implemented

- Complete target-chase match flow with Rookie / Pro / Elite, fair seeded targets, three wickets, match result statistics, and clean restart.
- Four distinct strokes, actual moving bat/ball collision, graded timing, directional impulses, and ball trajectories that respond to contact quality and height.
- 240 Hz fixed-step simulation: gravity, drag, pitch restitution, seam and swing, rolling friction, and swept stump tests. The renderer and collider share blade endpoints.
- Fast-medium run-up, release, follow-through, good/full/short/yorker/slower variations, and offline adaptation to recent shots and outcomes.
- Nine fielders plus wicketkeeper, predictive pursuit, reachable catches, ground retrieval, visible return throws, manual running, and run-outs.
- Legal-ball overs, extras, no-ball protection / free hits, bowled, caught, boundaries, target wins, all-out and over-limit losses. No LBW or stumping claims.
- Unlimited practice with pace and length controls; changes take effect on the next delivery.
- Interactive on-field tutorial, mouse-accessible actions, pause reference, persistent volume/graphics/camera/assistance settings, fullscreen where supported, and automatic pause on focus loss.
- Three batting camera choices, ball-follow presentation, boundary/wicket feedback, and slow-motion replays of recorded ball, bat, bowler, running, and fielder states.
- Original procedural Web Audio Foley and crowd ambience, synchronised to real simulation events. No third-party audio files.
- Original UV-mapped PBR stadium and cricket equipment; rigged players; exported animation clips; runtime arm IK; 4,500 lightweight instanced seated spectators at High quality.
- Live stadium menu, actual asset-load progress, recoverable loading failure screen, responsive HUD and menus.
- **CricVerse Lab:** adjustable physical delivery parameters, skill and timing, shot/aim, difficulty, seed, 10–500 delivery worker batches, measured metrics and charts, actual ball resolution map, CSV/JSON export, and live inspection.

## Architecture

| Location | Responsibility |
|---|---|
| `src/game/simulation.ts` | Delivery state machine, fixed-step orchestration, fielding, running, event and replay recording |
| `src/game/physics.ts` | Ball integration, trajectory prediction, swept blade contact and shot impulse |
| `src/game/rules.ts` | Pure score ledger, legal overs, boundaries, victory/loss |
| `src/game/bowling.ts` | Seeded offline bowler decisions and physically achievable delivery velocities |
| `src/game/lab.ts`, `lab.worker.ts` | Autonomous batter using normal swing/run inputs and the same simulation |
| `src/render/` | Three.js asset loading, skinning/animation, arm IK, lighting, crowd, cameras, rendering |
| `src/game/audio.ts` | Local sound synthesis and event playback |
| `src/App.tsx`, `src/ui/` | React menus and throttled HUD; saved preferences |
| `scripts/` | Reproducible Blender production, local fonts and asset validation |
| `production/` | Editable `.blend` files and Blender inspection renders |
| `public/assets/` | Game-ready GLBs, packed/baked texture images and manifest |
| `qa/` | Executed test screenshots, actual batch results, asset and balance reports |

The engine uses Three.js directly rather than React Three Fiber so the simulation and scene update outside React's render cycle. A specialised cricket integrator and swept blade tests provide reproducible high-speed contact without a general-purpose rigid-body dependency. HUD refresh is limited to approximately 12 Hz; physics is independent of display FPS. No external AI API is used.

### Blender pipeline

Blender 5.2.1 was used through its installed command-line Python API. The interactive MCP service was unavailable, so the work does not depend on it.

```sh
npm run assets        # macOS default path; edit for your Blender executable
npm run verify:assets
```

Or execute `blender -b --python scripts/build_assets.py`, then `blender -b --python scripts/build_crowd.py`. The first script can accept `-- characters`, `-- stadium`, or `-- equipment` for selective production. Modelling → UVs → locally generated PBR textures → skeletal rigging and action clips → material batching → GLB export. Sources are saved before export and inspection renders are saved in `production/`.

- Pitch: 20.12 m stump to stump, 3.05 m wide.
- Bat: 965 mm overall, with a 665 mm origin-to-toe collision alignment.
- Ball: 36 mm radius. Optional assistance increases only its visual size by 25%; simulation remains regulation scale.
- Stumps: 711 mm tall; separately modelled bails.
- Oval rope: 64.8 m × 58.968 m radii.
- Blender is Z-up; glTF exports are Y-up. All dimensions are metres.
- Each primary character contains a skeleton and eight named clips: Idle, Run, Bowl, Defend, Drive, Loft, Pull, Catch. Runtime IK aligns hands with the collision-driven bat. Bowler release is synchronised to its delivery pose.
- Stadium: approximately 100k triangles; spectator source: 264 triangles per instance. Quality presets change render resolution, shadow cost and crowd population.

## Validation and practical limits

See `qa/VALIDATION.md` for the final executed checks. Tests include scoring, illegal deliveries, swept contact, ball bounce, catches, manual runs, run-outs, pause, restart, match endings, practice, actual lab data, repeatable seeds, replay state and browser flows. Captured screenshots are real game output.

This is a functioning first playable release, not a claim of commercial AAA visual fidelity. The original characters are stylised procedural models with authored clips and IK; they are not scanned athletes or motion-captured performances. Fielding uses lightweight steering and reach tests, with a kinematic return-throw arc. Bowler line/height tracking positions the bat within a limited reach; the player controls timing, shot and aim rather than separate footwork. Equipment-body collisions, detailed injuries, LBW, stumping, bye/leg-bye play, fielding control, strike-specific individual statistics and a complete professional umpiring system are outside this build. Match-level score and the supported dismissals are implemented.

Audio is original synthesis rather than recorded stadium Foley. A held-background tab may be throttled by the browser; the game pauses when focus is lost. The 60 FPS target was observed in this local session, not certified across all laptop models. The interface adapts to narrow windows, but the full control scheme is designed for a desktop keyboard and mouse.

The lab deliberately permits repeated perfect inputs to yield identical outcomes. Its ball map shows the actual resolution position (rope crossing, catch, retrieval or wicket), not a fabricated first-bounce point. The measured charts and exports should be used to refine balance for additional pitches and bowling profiles.

## Phase 2

Additional original stadiums and teams, higher-fidelity athletes and motion capture, richer fielding/throw animation, more bowlers and spin styles, complete umpiring rules, tournaments/career, gamepad/touch control, weather and multiplayer.

## Asset provenance

All models, stadium architecture, fictional sponsors, procedural textures, animation clips and sounds are authored for this project by the included scripts/code. No Cricket 26 or other proprietary sports-game content is used. Barlow and Barlow Condensed are bundled under the SIL Open Font License; see `public/fonts/OFL.txt`. Npm dependency licenses remain in their packages. Font refresh is an optional developer operation (`npm run fonts`), never a runtime network dependency.
