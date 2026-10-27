# CricVerse — The First Innings

A desktop browser cricket game with a complete target chase, unlimited batting practice, a deterministic simulation lab, and Blender-built stadium and player assets.

**[Play CricVerse](https://krishnavgaming22-beep.github.io/cricverse/)** · [Inspect batting motion](https://krishnavgaming22-beep.github.io/cricverse/inspector.html)

## Play locally

Use Node.js 22.12+ and a recent browser with WebGL2.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Choose **Quick Match → Take the Crease → Start Innings** for a one, two or five-over chase with three wickets. Practice provides unlimited deliveries. Click once to enable sound.

| Input | Action |
|---|---|
| Mouse movement / left and right arrows | Aim, including after the bowler releases the ball |
| Left click on the field / Space | Commit the swing and lock its aim |
| 1 / 2 / 3 / 4 | Defend / grounded drive / lofted drive / pull |
| R | Attempt a run |
| C | Change camera |
| Esc | Pause or resume |

The swing reaches its contact phase about 0.18 seconds after input. Drives favour fuller balls; the pull meets a short ball later beside the body. Timing and actual blade contact determine the outgoing ball. Runs count when both batsmen complete a crossing; return throws can cause run-outs.

## Physics and batting

- Fixed 240 Hz simulation with gravity, shared aerodynamic drag, pitch bounce, swing, seam and rolling friction. Delivery velocities are solved against this same model for distinct bounce lengths.
- Swept sphere contact against a moving, oriented bat blade. The collision impulse uses relative ball/blade velocity, effective mass, restitution, friction and contact position. Shot names do not select an outgoing speed or elevation.
- A shared skeletal controller drives both the rendered bat and its collider. Two palm sockets follow the bat's named grips through arm IK. Hand paths are continuous through contact; the bat is constrained above the pitch.
- Drives lift and plant the front foot; lofts extend upward; pulls transfer weight onto the back foot. Hips, torso, head and hands have separate coordinated motion.
- The ball releases from the bowler's actual hand socket. Fielders accelerate toward predicted interception points, collect or catch, then return the ball through the same flight integrator.
- Legal-ball overs, wides, no-balls and free hits, bowled/caught/run-out dismissals, fours and sixes, target wins and match endings.

The game also includes recorded slow-motion replays, three cameras, local sound synthesis, quality and assistance settings, and a worker-based lab with seeded batches, charts and CSV/JSON exports. `inspector.html` compares all four strokes at six stages and exports measured grip errors.

## Development and validation

```sh
npm test                    # Rules, physics, rig, fielding and 1,200-delivery balance checks
npm run verify:assets       # GLBs, skins, UVs, source files and named clip inventory
npm run build               # TypeScript check and production bundle
npx playwright install chromium
npm run test:browser         # Production browser flows on localhost:4188
```

The preview uses port 4188 to avoid interfering with other development sessions. The Playwright launch arguments target macOS Metal; adjust the graphics backend on other platforms. GitHub Actions runs the unit/physics suite, asset checks and build before deploying to GitHub Pages. Relative asset URLs support the repository subpath.

| Location | Responsibility |
|---|---|
| `src/game/rig.ts` | Shared skeleton, footwork, two-hand IK and bowling release |
| `src/game/physics.ts` | Ball integration, swept blade/stump tests and impulse response |
| `src/game/simulation.ts` | Match state, fielding, running and replay recording |
| `src/game/bowling.ts`, `rules.ts` | Seeded bowling and score ledger |
| `src/game/lab.ts` | Automated normal inputs through the same simulation |
| `src/render/` | GLTF loading, skinning, cameras, stadium and crowd rendering |
| `production/` | Editable Blender sources and source-asset provenance |
| `public/assets/` | Game-ready models and textures |
| `qa/` | Test results, measured audits and real browser captures |

## Blender and asset provenance

Blender 5.2.1 was used through its command-line Python API. The continuous human base is a CC0 MakeHuman-derived mesh published by Innerscene; see [source attribution and license links](production/source-assets/LICENSES.md). The included rebuild script adapts its rig and adds cricket clothing, gloves, helmet, pads and boots. Stadium architecture, equipment, textures, fictional branding and synthesized audio are produced in this project. Barlow fonts are bundled under the [SIL Open Font License](public/fonts/OFL.txt).

```sh
npm run assets
npm run verify:assets
```

The asset command uses the macOS Blender application path; change it for another installation. It rebuilds the stadium and equipment, then runs `scripts/rebuild_characters.py` and the crowd pipeline. Do not use the legacy character generator to replace the licensed continuous human mesh.

The character GLBs contain eight named **rest-pose clip placeholders**. Gameplay movement comes from the layered runtime skeletal controller, not mocap or baked moving clips. The editable Blender sources and runtime controller are both included.

Units are metres. The pitch is 20.12 m stump to stump, the ball radius is 0.036 m, and stumps are 0.711 m tall. Blender exports convert Z-up to the game's Y-up coordinates. The ball keeps its physical visual scale.

## Practical limits

This is a playable prototype with substantial physics and pose corrections, not a commercial AAA release. Human motion is procedural; clothing and facial detail are simplified. The game assists lateral placement and reach while the player controls stroke, timing and direction. Detailed equipment/body collisions, LBW, stumping, byes/leg-byes, full umpiring, multiplayer and direct fielding control are not implemented. Return trajectories are physical, but fielding reach and catch decisions are simplified. Performance depends on the device; desktop keyboard and mouse are recommended.

No third-party services are needed at runtime. All assets are served with the build; the deployed site requires an initial network load and does not install a service worker. The game pauses on focus loss. See [validation notes](qa/VALIDATION.md) for executed checks and evidence.
