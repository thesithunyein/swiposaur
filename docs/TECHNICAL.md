# Swiposaur — Technical Document

A short, factual description of the current judging build, written for
judges and reviewers rather than players. Player-facing instructions live in
[README.md](../README.md).

- **Current version:** `1.1.1`, final jam build with twelve biomes and English/Burmese localization (the jam submission was `1.1.0`).
- **Playable URL:** <https://swiposaur.sithunyein.com/> (checked 29 October 2026; serves the final jam feature set; exact deployed commit not asserted).
- **Source:** [`main`](https://github.com/thesithunyein/swiposaur/tree/main) (`package.json` version `1.1.1`; the only release tag is the earlier `v1.0.0`).
- **Earlier snapshot:** [`v1.0.0`](https://github.com/thesithunyein/swiposaur/tree/v1.0.0) (six biomes; before Burmese localization).
- **Author:** Sithu Nyein (solo)
- **License:** Apache-2.0 ([LICENSE](../LICENSE))

---

## 1. What the game is

Swiposaur is a three-lane endless runner in the browser. The dinosaur, the
critters, the city, the weather and nearly every sound are generated in code at
runtime; the build contains no sprite sheets, no textures, and one recorded
audio file (the tail-whip swipe, `public/audio/swip.mp3`).
Its loop is built around one resource: **stamina**, which a landed tail-whip
refills and which the street drains. A run ends when stamina reaches zero or the
enraged crowd catches the runner.

## 2. Stack and build

| Layer | Choice |
| --- | --- |
| UI | React 19 (function components, hooks only) |
| Simulation | Plain TypeScript class `GameEngine`, no React involvement per frame |
| 3D | Three.js with hand-built voxel meshes from primitives |
| Audio | Web Audio API, synthesised at runtime, plus one recorded swipe sample |
| Styling | Tailwind CSS v4 |
| Bundler | Vite 8 |
| Tests | Vitest (node environment for rules, jsdom for UI) |
| Server (optional) | Express for the dev API; a serverless function on the deployed host |

`npm run build` emits one JS bundle plus one CSS file. In the build checked 31
October 2026, JavaScript was 1,143,400 bytes (297,756 bytes gzipped) and CSS was
98,243 bytes (14,320 bytes gzipped): together 1,241,643 bytes raw and 312,076
bytes gzipped (about 305 KiB). The complete `dist/` directory was 1,406,506
bytes, including icons, metadata and the 9,523-byte swipe recording. These are
generated-build measurements, not
source tree size. There is no code splitting yet; see §12.

## 3. Module map

```
index.html                     page shell, fonts, meta, viewport
src/main.tsx                   React entry
src/App.tsx                    screen state machine, persistence wiring, input routing
src/game/GameEngine.ts         run loop, collisions, stamina, whip, chase, scoring
src/game/ThreeGameRenderer.ts  scene, camera, road, props, weather, camera shake
src/game/DinoMeshBuilder.ts    voxel dinosaur construction
src/game/IsometricRenderer.ts  menu/attract-mode 2D presentation
src/game/SoundEngine.ts        synthesised SFX, swipe sample playback, audio unlock
src/game/{constants,maps,levels,grades,obstacleRules,obstacleDensity}.ts
                               tuned data and pure rules for the world
src/game/i18n.ts               English/Burmese copy, language store, document lang
src/game/dailyMissions.ts      five missions a day, Myanmar-time reset
src/game/dailyRewards.ts       seven-day egg streak
src/game/leaderboardCore.ts    platform-free validation and ranking rules
src/game/leaderboard.ts        on-device board, online client, player identity
src/game/shareCard.ts          1080x1350 PNG run card
src/components/                screens, HUD, modals, touch controls
server/leaderboardStore.ts     file store (dev) and Redis REST store (deployed)
api/leaderboard.ts             the shared HTTP handler
server.ts                      optional local full-stack server
tests/                         Vitest suites
```

The important boundary: **rules are pure functions, the engine owns time, React
owns presentation.** `leaderboardCore.ts` is imported unchanged by the browser,
the Express server and the serverless handler, so a run that the client accepts
cannot be rejected by the server for a different reason, and vice versa.

**World content is data, not code.** `maps.ts` defines twelve biomes (colour,
fog, props, weather, celestial body and the renderer style they reuse) and
`constants.ts` defines twelve wardrobe skins plus three legacy aliases kept so
old saves and submitted scores still resolve. `levels.ts` maps a level to the
biome it unlocks; the six later habitats arrive at levels 45, 55, 65, 75, 85
and 95, each paired with a skin. Adding a biome is a data change plus a style
choice, not new geometry.

**Localisation is a lookup layer.** English strings are the keys, so any screen
that has not been translated keeps working; `i18n.ts` holds the Burmese table,
a module-level language store read through `useSyncExternalStore`, and the
`document.documentElement.lang` switch that `index.css` uses to put the Aka 08
Myanmar face ahead of the Latin display fonts. Burmese is the default; the
choice is persisted under `slap_run_language`. A test walks `GAME_MAPS` and
`CHARACTER_SKINS` and fails if any shipped map or skin is missing a translation.

## 4. Frame loop

`GameEngine.loop()` runs on `requestAnimationFrame`. Delta time is capped at
32 ms so a background tab cannot teleport the world on return, then normalised
to a 60 Hz factor (`dt / 16.666`) before it reaches gameplay code. All tuning
is therefore written in per-frame units at 60 FPS, and a slow device produces
the same simulation at a lower frame rate rather than a different game.

State is an explicit union: `MENU | PLAYING | PAUSED | GAMEOVER`. The engine
keeps its own state and publishes `GameStats` to React through a callback; React
never mutates the engine mid-run, and leaderboard updates cannot rebuild it
(there is a regression test for exactly that — `tests/appLeaderboard.test.tsx`).

Hit-stop is deliberate: a landed whip freezes the simulation for 50–70 ms to
give the impact weight, while the renderer keeps drawing.

## 5. Player systems

- **Stamina.** A run starts at 100 (up to +40 banked from rewards, capped). From
  second 6 the street drains it at an accelerating rate, so distance alone ends
  a run. A landed whip refunds +22 (keyboard) or +26 (touch); a hit costs 35–45
  and starts a 6-second chase.
- **Tail-whip.** Reach is 282 world units on the desktop layout and 310 on the
  mobile layout, which is what makes the wider touch street playable: every
  glowing critter is inside reach from all three lanes.
- **Chase.** After a hit the crowd closes for six seconds. Escaping early is
  tracked (`longestChaseEscape`) and feeds achievements.
- **Flame mode.** A pickup lets the dino burn certain props instead of dodging
  them, for ten seconds.
- **Mobile-only assists.** The touch layout widens the road by 12 %
  (`TOUCH_ROAD_WIDTH` 314, lanes ±101), lowers and pulls back the camera, and
  auto-swings at a glowing critter **only while airborne** — the moment one
  thumb has to jump and whip at once. Ground whips stay manual, so stamina and
  failure states stay real.

## 6. Scoring and grades

Score is accumulated from distance, coins, vaults, near-misses and whip combos,
multiplied by the Roar meter (1× → 2× → 4× → 8× → 16×). Grades are read off the
run, not the score: **C** under 350 m · **B** 350 m · **A** 800 m · **S** 1,400 m
with a 10× combo · **S+** 2,000 m with a 15× combo.

## 7. Persistence

All state is on the device. Every key is namespaced `slap_run_*`:

| Key | Contents |
| --- | --- |
| `slap_run_highscore` | best score |
| `slap_run_total_coins` | coin bank spent on skins |
| `slap_run_unlocked_skins` / `slap_run_selected_skin` | skin roster and choice |
| `slap_run_daily_rewards` | egg streak, last claim day, claimed days |
| `slap_run_daily_missions` | today's five missions with progress |
| `slap_run_level_progress` | unlocked level, stars, best score per level |
| `slap_run_hall_of_fame` | this device's best runs |
| `slap_run_share_name` / `slap_run_player_id` | board name, stable player id |
| `slap_run_language`, `slap_run_settings`, `slap_run_muted` | preferences |

Reads are defensive: a corrupt or blocked `localStorage` falls back to defaults
instead of throwing, and the game stays playable.

## 8. Daily systems

Both dailies reset on **Myanmar time (UTC+06:30) midnight**, computed by a day
number, not by the device clock's timezone.

- **Missions.** Five objectives per day drawn from a rotating pool of twelve,
  keyed to a day number so the same day always produces the same set: two easy,
  two medium and one hard, each on a different metric so a day never repeats an
  objective. Progress is folded in when a run ends (`updateMissionsOnRun(stats)`)
  from real run stats — distance, whips, coins, combo, grade. Each mission
  claims independently and pays 80–150 coins plus +20 stamina for the next run.
- **Login eggs.** Seven tiers (50 → 800 coins). A claim on the next day advances
  the streak; missing a day steps it back exactly one stage rather than wiping
  a week of progress.

Both are enforced client-side on the same device. They are progression systems,
not a source of truth for anything competitive.

## 9. Leaderboard

**Two modes, and the client only claims what it can prove.**

1. **Online.** The client probes `GET /api/leaderboard`. Only a response with
   `storage: "durable"` switches the board into online mode. One row per player
   (a better run replaces your row), ranks computed server-side.
2. **Local.** If the endpoint is missing, broken or non-durable, or the request
   fails, the board becomes an on-device Hall of Fame *labelled as such*
   ("Saved on this device") with a local rank. The game never invents a global
   board.

**Shared validation** (`leaderboardCore.ts`), applied by client and server:

- `playerId` and `runId` must be 8–64 URL-safe characters.
- `score` must be a whole number, 1 … 5,000,000; `maxCombo` 0 … 250.
- `skinId` must be one of the shipped skin ids — twelve wardrobe dinosaurs plus
  three legacy aliases (a test keeps that list in sync with `CHARACTER_SKINS`).
- Names are sanitised to 16 characters and `YOU` if empty.
- **Plausibility.** A score above 50,000 must also carry `durationMs` (the run
  length measured by the engine, 8 s … 20 min) and must not exceed 2,500 points
  per second. A bare "post 5,000,000" submission is rejected with 400.

**Server behaviour:** idempotent on `runId` (a retry can never add a second
row), rate limited to 6 submissions and 6 renames per minute per address,
`Cache-Control: no-store` on every response, and a 500 — never a fabricated
rank — if the store throws.

**Stores.** The dev server writes an atomic JSON file (`.data/leaderboard.json`,
temp file + rename). The deployed endpoint uses a Redis REST store (Upstash /
Vercel KV). If neither is configured the handler answers 503 with
`storage: "unavailable"` and the client stays local.

**What this is not.** Scores are self-reported. Validation, rate limiting and the
plausibility check stop accidents and lazy cheating; they do not stop a
determined attacker, which would need signed runs or server-side replays. The
board says so in the UI.

## 10. Sharing

The Game Over screen renders the finished run as a 1080×1350 PNG
(`shareCard.ts`) and hands it to the platform share sheet
(`navigator.share({ files })`) when the browser supports sharing files.
Desktop browsers without a share sheet download the PNG instead, so the feature
works everywhere rather than silently failing. Dismissing the sheet returns the
button to its idle state. Covered by `tests/gameOverShare.test.tsx`.

## 11. Rendering and performance budget

- One `WebGLRenderer` per page, created with `antialias: true`,
  `powerPreference: 'high-performance'`, ACES Filmic tone mapping and a basic
  (hard, pixel-art) shadow map — deliberately the cheapest shadow type that
  matches the voxel look.
- Device pixel ratio is capped at **2.0 on desktop and 1.5 on narrow viewports**
  (short side under 500 px). A 3× phone rendering at 3× costs ~4× the fragment
  work of 1.5× for pixels a 6-inch screen cannot resolve.
- Geometry is built once at start-up from primitives and reused; the road is a
  small number of recycled segments, spawns beyond the fog are culled.
- Everything is code — no image decoding and no audio decoding. The app shell
  loads one HTML document and a JS/CSS bundle; external font CSS and font files
  load from Google Fonts and jsDelivr. When enabled, the leaderboard also makes
  same-origin `/api/leaderboard` requests (probe, score submission and rename).

Honest gap: frame rate has been verified by playing, not instrumented with a
frame-time histogram. The submitted claim is "target 60 FPS on a modern phone",
not a measured guarantee on every device; very old low-end GPUs can drop below
30 FPS. Measuring this properly is the next item on the list (§12).

## 12. Known limitations and next steps

1. **No frame-time instrumentation.** Averages hide hitches; a rolling p95
   frame time on screen would be honest and useful.
2. **One bundle.** 1,143,400 bytes minified in the build checked 31 October
   2026, over Vite's 500 KB warning. Code-splitting the renderer would shrink
   time-to-first-frame on a phone.
3. **No service worker.** The manifest gives an "Add to Home Screen" shortcut,
   not offline play or an install prompt.
4. **Browser checks are manual.** Chrome (desktop and mobile), Firefox, Edge and
   Safari (macOS and iPhone) were played through by hand for this build; there is no
   automated cross-browser run. iOS audio unlock is implemented (`sounds.unlock()`
   on the first pointer down).
5. **Self-reported scores**, as described in §9.
6. **Missions and rewards are device-local**, so clearing storage resets them
   and a second device starts a fresh streak.
7. **Fonts load externally.** Fredoka, Lilita One, Titan One, Sniglet, Press
   Start 2P and Noto Sans Myanmar are requested from Google Fonts; Aka 08 is
   requested from jsDelivr. The Google Fonts stylesheet may reference font files
   from `fonts.gstatic.com`. When unavailable, the UI uses local/system fallbacks.
   The Google Fonts families are SIL OFL 1.1. The Aka 08 source repository does
   not state a license in its metadata; verify redistribution terms with its
   author before redistributing the font.

## 13. Tests

168 tests across 17 files (`npm test`), all passing in the verification run for this documentation update. Typecheck is run separately with `npm run typecheck`:

| Area | Files |
| --- | --- |
| Gameplay rules | `gameEngine`, `whipReach`, `obstacleRules`, `obstacleDensity` |
| Progression | `dailyRhythm` (missions, streak, Myanmar midnight) |
| Leaderboard | `leaderboardCore`, `localLeaderboard`, `leaderboardStore`, `leaderboardHandler`, `leaderboardUi`, `appLeaderboard` |
| Presentation | `bootScreen`, `bootSequence`, `i18n`, `gameOverShare` |

The suites test behaviour, not implementation: mission progress from real run
stats, idempotent submissions, a broken store returning 500 instead of a rank,
an impossible score rejected, a failed API submission never showing a global
rank, and the share card falling back to a download.

CI (`.github/workflows/ci.yml`) runs typecheck, the full suite and a production
build on every push, so the deployed commit is the commit that passed.
