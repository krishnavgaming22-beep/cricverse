# Rescue defect register — 25 October 2026

Checkpoint: `a2f5d30` (first playable build, before the rescue).

| Severity | Defect / actual cause | Affected source | Repair and evidence gate |
|---|---|---|---|
| P0 | The bat is placed in world space; arms are asked to reach targets that can exceed their reach. The IK assumes local bone Y is the exported limb direction and aims the wrist origin at a grip without accounting for the palm. | `game/physics.ts`, `render/character.ts`, `render/scene.ts` | Rig-local grip controller, named palm/grip sockets, exact bone-axis calibration, joint limits, reach validation. Capture all four strokes at six stages; measure socket separation. |
| P0 | Release is a hardcoded `RELEASE` point. A last-moment hand IK adjustment tries to meet it rather than deriving release from the hand. | `game/bowling.ts`, `game/simulation.ts`, `render/scene.ts` | Shared authored full-body bowling pose and actual hand socket transform; transfer to ball physics at a release event. Before/after frame and positional continuity test. |
| P0 | Contact uses a capsule around a blade centreline, then substitutes a shot-speed/elevation formula. No actual surface impulse, moving contact-point velocity, or blade contact location. | `game/physics.ts`, `game/simulation.ts` | Swept oriented blade, moving surface velocity and normal, restitution, edge/middle contact, impulse-based outgoing velocity. Seeded trajectory and aim comparisons. |
| P1 | Four strokes share essentially one blade path. The renderer overrides much of the exported torso/leg animation. | `game/physics.ts`, `render/character.ts` | Separate biomechanical pose curves, foot planting, hips/spine/head motion, and stroke-specific face orientation. Side-by-side frame captures. |
| P1 | A/D-only placement is undiscoverable; live mouse aiming is absent. | `App.tsx`, `render/scene.ts`, `ui/settings.ts` | Screen-to-ground raycast aiming through release; arrows as alternative; freeze aim on commitment. Browser input sequence test. |
| P1 | Fielding has instant constant-speed motion and a simplistic nearest-player choice; collection/throw poses are weak. | `game/simulation.ts`, `render/scene.ts` | Interception assignment, acceleration and turn limits, difficulty-dependent reactions, collection/catch/throw states with visible poses. Deterministic fielding scenarios. |
| P1 | Disconnected rigid-weight anatomical segments produce toy-like bodies and visible shoulder seams. | `scripts/build_assets.py`, primary character GLBs | Replace body topology with a licensed continuous human base, preserve smooth skin weights, refit cricket kit in Blender. Source/license and deformation review. |
| P1 | Identical radial grandstand bays, coarse stretched pitch UVs and generic lighting undermine visual believability. | `scripts/build_assets.py`, stadium GLB, `render/scene.ts` | Distinct pavilion/stand zones, access aisles, finer ground UVs/textures, coherent evening lighting. Actual camera before/after captures. |

## Reference access

The supplied YouTube pages were reachable as metadata, but browser playback redirected to a Google Workspace sign-in requirement. No claim is made to have watched either video. Accessible official product visuals and human/biomechanical references will be used without copying assets. No user gameplay recording or bug-image attachment was found in the project inventory; existing in-game QA screenshots are retained as baseline evidence.

Passing score/state tests does not establish animation or visual quality. The rescue requires separate rig, input, contact, fielding, and visual gates.
