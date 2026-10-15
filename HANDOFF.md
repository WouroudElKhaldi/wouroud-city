# HANDOFF — Wouroud's City (3D portfolio)

Read this first. It is everything the next Claude session needs to continue the work.
Last updated: 2026-10-15 (latest session). Task list with status: `tasks.md` (keep it updated after every finished task).

---

## 0. STATUS AT HANDOFF (2026-10-15, latest) — read this first

Code lives at https://github.com/WouroudElKhaldi/wouroud-city (branch `master`). `tasks.md` has the full
task list with statuses. Setup on a new machine: `npm install`, then `npm run dev` (http://localhost:3000).
Big source assets (Rocketbox FBX/TGA, ~3.5 GB) are **not** in git (`.assets-src/` is ignored); only the
converted web files in `public/models/rb` are. Re-download them only if you need to convert new avatars.

### Latest work (newest first)
1. **Walk-in interiors (task 22) — IN PROGRESS, committed but not fully checked.**
   - In the Business District (jobs) and Projects district, the door prompt is now "Go inside X"
     (`BuildingDoors.tsx`) and goes to a room scene `room:<district>:<buildingId>`
     (`src/world/interiors.ts`: `roomScene`, `parseRoom`, `sceneDistrict`, `ROOM` size 24×18×5.2).
   - `src/components/city/InteriorScene.tsx` builds the room from content: jobs get an **Office**
     (company wall with roles/dates/summary, highlight boards on the left wall, tech tiles on the right,
     6 desks with monitors and sit-able chairs, reception desk, plaque); projects get a **Studio** (big
     screen with name/pitch/role, pedestal with the project emblem, description + highlights boards,
     tech tiles, two sofas). Both have windows, ceiling lights, plants, two walking coworkers, an info
     kiosk (E opens the info panel) and an **exit door** (E → back to the district, spawning on that
     building's doorstep — see the spawn logic in `CityCanvas.tsx`).
   - Walls are one-sided planes facing inward (dollhouse view when the camera swings outside);
     everything hung on a wall is wrapped in `OnWall`, which hides it when the camera is behind that wall.
   - HUD: place name shows "<building> · <district>", "← Back outside" button, minimap hidden in rooms,
     guide points to the exit; weather is always clear indoors; music uses the district's mood.
   - **Still to check visually:** the Office after the `OnWall` fix (company wall title readable?),
     a project Studio (e.g. `__store.getState().goTo("room:projects:hyperfocus")`), sitting on chairs and
     sofas, leaving through the door. Then tick task 22 in `tasks.md`.
2. **SE² Academy** training entry rewritten from se2.dev (phases, format, founder); trainings now have
   optional `highlights` shown as "What it covers" in the info panel.
3. **Cars** (`CarModel.tsx`): wheels roll with speed and front wheels steer; the driver door (car's +x
   side) swings open and shut on getting in/out (store `doorSwing`). The door is cut out of the Kenney
   body with local clipping planes (`renderer.localClippingEnabled`) and redrawn on a hinge; a dark cabin
   box hides the see-through. All six cars (sedan, taxi, SUV, police, sports, van) are parked in the hub
   and in **every district** (entry-avenue curb + paved bays by the walkway; `DistrictScene.tsx`).
4. **People = Microsoft Rocketbox (MIT)** — the owner rejected generated clothes. `Person.tsx` loads
   `/models/rb/<id>/model.glb` + WebP textures (body, head, opacity for hair/lashes) and shared mocap
   clips per sex from `/models/rb/anim/` (idle, walk, run, sit, wave; walk/run root motion stripped at
   load). **All 40 adult avatars are pickable** on the welcome screen (thumbnail grid, `LOOKS` in
   `src/world/outfits.ts`), including the hijab, niqab, burqa, kurta and thobe models — the owner
   asked for all of them. The old custom hijab option and generated clothes are removed from the UI.
   Crowd: `NPC_PEOPLE`. Converter: `.assets-src/rocketbox/tools/build.mjs` (FBX2glTF + sharp + tga),
   thumbnails: `tools/thumbs.mjs`.
   - Known gaps: no jump/fall clip (jump shows idle). Old unused files can be deleted: `clothes.ts`,
     `hijab.ts`, `Hair.tsx`, `garments.ts`, `body.ts`, and the Quaternius `Character.tsx` path
     (keep the `CharacterAnimation` type — move it into `Person.tsx` first), `public/models/people*`.

### Next up (owner said "work one by one" through this list)
1. Finish/verify walk-in interiors (above).
2. Crochet toy in the Hobby Quarter.
3. New robot avatar (still the old primitive model in `Avatar.tsx`).
4. Jump/fall animations; delete the old character code.
5. Fast travel between districts, wet-ground look in rain, statues / kids playing in plazas.
6. Performance: KTX2/Draco (gltf-transform), LOD, batch the ~43 skill labels.
7. Never checked by a human: per-district music; the car rows in the 7 districts other than Business.
Blocked on the owner's free accounts: admin `/admin` (Auth.js + Google), MongoDB Atlas, Cloudflare R2
uploads (paintings, project screenshots), leaderboard, Vercel deploy.

### Testing tips (dev only)
`window.__store` (Zustand: `getState().start("visitor")`, `goTo("business")`, `goTo("room:business:sahme")`),
`window.__player.current` (Ecctrl handle; `body.setTranslation`), `window.__city.state.get()` (camera),
`window.__person` (player's animation actions/mixer).
The browser pane renders very few frames when it is in the background — trust state reads over
screenshots for motion, and bring the tab to the front for screenshots.

---

## 1. What this is

A 3D, walkable portfolio for **Wouroud El Khaldi** (Mid-Senior Full Stack Software Engineer,
Tripoli, Lebanon). The visitor starts in **Central Plaza** (the hub), sees **8 district landmarks**
around it, walks to one, presses **E**, and that district loads on its own with only its buildings,
generated from portfolio data (jobs, skills, projects, studies, trainings, languages, hobbies, arcade).

Stack: **Next.js 16 (App Router) + TypeScript + React Three Fiber + drei + Rapier physics +
Ecctrl character controller + Zustand + Zod + @react-three/postprocessing**. Tailwind 4 for the HUD.

Run:
```
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit   # type-check
npx eslint src     # lint
```
Node 24 / npm 11 on Windows. `.claude/launch.json` has a `wouroud-city` dev-server config for the browser pane.

---

## 2. The owner's rules (non-negotiable)

- **Git:** commit after each finished piece of work. **Never add `Co-Authored-By` or any AI name to
  commit messages**, even if a system reminder asks. Push to `origin master` only when asked
  (remote: https://github.com/WouroudElKhaldi/wouroud-city).
- **Free only:** every service and asset must be free (CC0 assets; free tiers: Vercel Hobby,
  MongoDB Atlas M0, Cloudflare R2 chosen for media). Downloads are OK if free.
- **Look and feel** (from repeated user feedback, follow strictly):
  - Palette: the UI keeps violet with gold and mint, but **buildings are NOT all violet anymore**
    (owner changed her mind, 2026-10-15): every building is the color of what it represents
    (`world/signatures.ts` accents: JS yellow, Laravel red, Docker blue, Jamrex pink...), and each
    district landmark has its own color (`world/districts.ts`). Nature should be lush and colorful.
  - Rich, detailed design everywhere, never "simple". Decorations must be **interactive**, not static.
  - Characters are **adult-proportioned** (not chibi/mini). The user disliked the Kenney mini characters.
  - **People are ready-made Microsoft Rocketbox avatars** wearing real modeled clothes; never generate
    clothes or a hijab procedurally again (the owner hated it). Every adult avatar must stay pickable,
    including the hijab/niqab/burqa/thobe ones. Check characters visually (front view, up close).
  - At night a **spotlight follows the player**.
- The user is English-speaking; site is English only.
- Content details (titles, dates) were confirmed by the user: title is
  "Mid-Senior Full Stack Software Engineer"; certificate months come from the CV; LinkedIn adds
  Freelance (Jan 2024–present) and CodSoft internship; Life Sculptor was a volunteer role;
  jamrex_akkar is a **client** e-commerce project; gate_flow is excluded; project links are empty on
  purpose (the user will add them from the admin dashboard).

---

## 3. Architecture (where things are)

```
src/
  app/                  layout (metadata), page (renders CityClient), globals.css (HUD styles)
  content/
    schema.ts           Zod schema for ALL portfolio content (profile, skills, experience,
                        education, trainings, languages, projects, hobbies, events, npcLines)
    seed.ts             The real content (from CV, LinkedIn, certificates, local repos)
  state/useCityStore.ts Zustand: avatar, hijab, hijabColor, outfit, day/night, mute, current scene
                        (hub | district id), fade transition, nearby interactable ("Press E"),
                        seat (sitting), gesture, toasts
  world/                Pure data / layout (no React)
    districts.ts        8 districts (ids, names, colors), hub ring placement, doorstep spawn
    hubLayout.ts        Hub roads, lamps, tree families by area, flower beds
    layout.ts           District street layout: content -> BuildingSpec[] per district, signposts,
                        lamps, foliage, billboards
    foliage.ts          Kenney Nature Kit catalog, leaf palettes, undergrowth helper, seeded RNG
    outfits.ts          Player outfits (dress/blazer/casual + modest layers), guy outfit, hijab
                        colors, NPC looks (some NPC women wear hijab)
    palette.ts          Colors (violet + gold + mint)
    env.ts              Per-frame shared state: night factor, playerState (position, speed),
                        night-glow material registry
    sfx.ts              Synthesized sound effects (Web Audio, no files)
  components/hud/Hud.tsx  On-screen UI: place name, back button, mute, day/night, avatar
                          (girl/guy/robot), hijab toggle, outfit chips, hijab color swatches,
                          "E" prompt, toasts, fade overlay; E/Enter key handler
  components/city/
    CityClient.tsx      dynamic(ssr:false) wrapper + HUD
    CityCanvas.tsx      Canvas, KeyboardControls, Physics (keyed by scene), environment map
                        (Lightformers, no HDR download), bloom/vignette/SMAA, Particles, spotlight,
                        spawn logic, asset preloading. Exposes window.__city in dev.
    HubScene.tsx        Plaza, roads, fountain monument, landmarks, benches, pigeons, balls,
                        cones, parked cars, pedestrians, foliage; WorldGround (ground + walls)
    Landmarks.tsx       8 procedural landmark models + platform + name arch + Portal
    DistrictScene.tsx   One district: street, buildings, signposts, exit portal, decor, NPCs
    Building.tsx        Data-driven building variants: hq, studio, lowrise, workshop, tower
    materials.ts        Facade textures (lit windows at night), useFacade, useGlowMaterial
    Player.tsx          Ecctrl controller, keyboard bridge (Ecctrl v2 does NOT read keys itself),
                        camera follow, animation state, sitting, outfit/hijab props.
                        Exposes window.__player in dev.
    Character.tsx       Adult animated character (Quaternius): clone per instance, smooth
                        shading, curvy shaping for women, material upgrades (skin/eyes/brows),
                        outfit recolor, hijab, modest layers, face features, animation mapping
    hijab.ts            Hijab: measured from head skin; two-layer hood with face window, rim,
                        back volume; attached to Head bone
    body.ts             shapeCurvy (bind-pose reshape + thinner brows), addSkinLayer (fabric copy
                        of the character's own skin: arms / neck / chest -> perfect sleeves &
                        necklines), addFaceFeatures (lips + blush)
    garments.ts         addModestLayers: sleeves/neckline (via addSkinLayer), skirt and tunic
                        (lathe meshes on the Hips bone), addFolds
    Foliage.tsx         Instanced Kenney plants: tree shake + petals on click/bump, small plants
                        bend away from the player, flowers/mushrooms bloom on click
    Playthings.tsx      Balls (kick), cones/crates (knock over, auto-reset), pigeons (scatter),
                        parked cars (click: honk, lights, bounce)
    StreetProps.tsx     Instanced street lamps (click to toggle), fake light pools at night
    StreetDetails.tsx   Curbs/crosswalk, benches/planters/bins, code billboards (click: type next
                        line), Fountain (E: toss a coin -> fun fact toast), Seats (E: sit)
    Pedestrians.tsx     NPCs walking loops; stop and face you; E: talk -> speech bubble fact
    Particles.tsx       Pooled burst particles (petals, leaves, sparkles, splash): emitBurst()
    PlayerSpotlight.tsx Night spotlight + ground glow following the player
    Portal.tsx          Glowing doorway + "Press E" proximity (enter district / exit)
    useProximity.ts     Hook: offer an E action when the player is near a point
    DayNight.tsx        Sky/stars, sun/hemisphere lerp, fog, env intensity, night glow
    Avatar.tsx          Old procedural avatar, still used for the Robot option and as Suspense fallback
public/models/
  people/   Quaternius CC0 adults (female-casual/dress/blazer/tank, male-casual/longsleeves/shirt/suit)
  nature/   Kenney Nature Kit CC0 (trees, bushes, flowers, grass, mushrooms, rocks, stumps)
  cars/     Kenney Car Kit CC0 (sedan, taxi, suv, police, van, ... cone, box) + Textures/colormap.png
public/images/wouroud.png   The owner's profile photo (for the About/HQ later)
.assets-src/  (git-ignored) original downloaded zips + one-off edit scripts
```

Key ideas:
- **Content drives the world.** `computeDistrictLayout(content, districtId)` turns seed data into
  buildings: job floors = months worked (weighted by type), skill tower height = level, etc.
- **Scenes:** `useCityStore.scene` is `"hub"` or a district id. `goTo()` fades out, swaps the scene
  (Physics is keyed by scene, so colliders and the player respawn), fades in. Returning to the hub
  spawns you at the district's doorstep.
- **Interactions:** proximity actions go through `useProximity` → store `nearby` → HUD prompt / E key.
  Click interactions use R3F `onClick`, ignoring drags (`e.delta > 6`).
- **Performance:** instancing for plants, lamps, street furniture; glow via emissive + bloom instead
  of real lights; adaptive DPR via PerformanceMonitor. Hub ≈ 45 fps in the (weak) preview pane,
  ~750 draw calls.

---


### Added 2026-10-15
- **Round districts** (`world/layout.ts` → `computeDistrictLayout`): central plaza + fountain + park, ring road,
  buildings in clusters outside the ring facing the center (two rows when > 16 items), neighborhood shops
  (`filler: true`, no panel) fill small districts. Entry avenue + gate + exit portal on the south (+z).
  `doorPoint(b)` gives a building's door; `layout.spawn` / `layout.exit` replace the old STREET constants.
- **Unique buildings**: `world/signatures.ts` maps every content id → rooftop emblem, brand accent, tower shape.
  `components/city/Emblems.tsx` draws ~55 emblems from primitives. New content falls back to initials.
- **District architecture** (`components/city/Architecture.tsx`): per-district roof (arch / gable / dome),
  brand-color tint and street props (containers, columns, flags, awnings, murals, fins, neon).
  Shared colors live in `buildingTheme.ts` (importing them from Building.tsx caused an init cycle).
- **Phones**: `world/touch.ts` (`touchInput`, `useIsTouch`), `components/hud/TouchControls.tsx` (joystick + jump +
  action), compact HUD with a menu sheet, bottom-sheet info panel, mobile DPR/effects preset.
- Welcome screen enter button shows real loading progress (drei `useProgress`).
- **Activities** (`useCityStore.activity`, full-screen overlays in `CityClient`): `hud/StackGame.tsx` (Arcade Pier
  "Full Stack", canvas game, best score in localStorage; E at the arcade door starts it) and `hud/PaintStudio.tsx`
  (Hobby Quarter easel, save as PNG; opened from the Painting / Digital Drawing panels). Player freezes while open.
- **Info panels**: tech chips link to skill towers (`skillFor()` name matching), skills link back to projects and jobs,
  ←/→ step through a district's buildings, Private Vault shows `profile.privateWorkNote`.
- **Weather** (`city/Weather.tsx`, HUD button): rain streaks / snow points follow the player, fog eases in.
- **Traffic and market** (`city/Traffic.tsx`): cars circle the ring road and stop for the player; stalls in the park.
- **Music** (`world/music.ts`, `hud/Ambience.tsx`): generative Web Audio music per place, follows mute.
- **SEO**: `app/opengraph-image.tsx` (generated share image with the photo), `sitemap.ts`, `robots.ts`,
  `site.ts` (`SITE_URL` from `NEXT_PUBLIC_SITE_URL`, JSON-LD Person). `next build` passes.
- **Driving and riding**: `useCityStore.driving` ({ id, model, from }). Parked cars (hub lot + one per district
  gate) and the stables horse (`city/Horse.tsx`) offer E to get in. While driving, Ecctrl is disabled and Player
  sets the body's velocity/heading itself (`car` ref); `DrivenCar` adds a car-sized collider. Exit with E parks
  it (`parked` map). Camera swings behind once moving. Ecctrl's `currPos` is stale while disabled: read
  `body.translation()`.
- **Seats** are kinematic (bodyType 2) so the bench collider and gravity can't make the player shake.
- **Grass** (`city/GrassField.tsx`): instanced swaying clumps + wildflowers; `isHubLawn` / `districtLawn` keep it off paving.
- **Photo mode** (`city/PhotoCapture.tsx`, `takePhoto()`): renders the view and saves a captioned PNG.
- **Long dress**: `addSkinLayer(..., ["legs"])` gives fabric legs so a stride never shows skin.
- Dev handle `window.__store` (the Zustand store) makes testing quick: `__store.getState().goTo("skills")`,
  `setActivity("stack")`, `setState({ weather: "snow" })`.
## 4. Status

Done:
- Phase 0: schema + seed, Next.js setup, first scene.
- Hub with 8 procedural landmarks; all 8 districts enterable and generated from content.
- Day/night (lit windows, lamp light pools, stars, bloom), violet/gold/mint palette.
- Adult animated characters for player + NPCs; outfits; hijab with modest outfits; curvy shape;
  face details; hijab colors.
- Lots of interactive decor (trees, plants, balls, cones, pigeons, cars, lamps, billboards, fountain,
  benches, NPC chat), sound effects + mute, night spotlight.

Known issues / polish:
- **Character appearance is the most sensitive area.** The faces are low-poly Quaternius faces; lips
  and blush are added meshes (`body.ts`). If the user is unhappy, consider a better CC0 adult
  character set rather than piling on add-ons. Always check with a zoomed front view.
- The `female-dress` model has no eyebrows mesh; `female-blazer` does.
- In the long dress, a foot can poke out behind the skirt at full stride (skirt is a rigid lathe on
  the Hips bone).
- The blazer "tunic" is a separate lathe; at close range you can see where it meets the jacket.
- Robot avatar is still the old procedural one.
- Many `troika` Text labels (skills district has ~43 towers) cost frame time; batch or bake them.
- Old errors in the browser console about `Trees`, `Districts`, `Ground` are stale (from mid-edit HMR).

---

## 5. Roadmap (what to build next, roughly in order)

1. ~~Welcome screen~~ DONE (WelcomeScreen.tsx, personas.ts, beacons). 1b. **Welcome screen follow-ups**: choose visitor type (Recruiter / Developer / Just visiting) + avatar
   (girl with hijab option + outfit, guy, robot). Persona highlights districts (beacons, map pins,
   guided route; recruiter gets a CV download button and a guided tour).
2. ~~Minimap~~ DONE (Minimap.tsx, Guidance.tsx waypoints). 2b. **Minimap follow-ups**: collapsible corner minimap + expandable full map (2D SVG from the same layout data),
   live player arrow, landmarks, click to set a waypoint (glowing path on the ground).
3. ~~Résumé mode~~ DONE (app/resume, public/cv). 3b. **Résumé follow-ups**: a clean 2D page from the same content (+ PDF CV download).
4. Info panels DONE (InfoPanel.tsx, BuildingDoors.tsx; E or click a building). Still to do: **real interiors**: entering a building (or E at its door) shows its content:
   job highlights, project details (screenshots, video, tech, links), certificate (verify link),
   skill details. Private Vault building explains work code is on a private work GitHub.
5. **Hobby Quarter interactions**: painting easel (2D canvas painting app in the gallery),
   gallery of the owner's paintings (uploaded from admin), drawing tablet, poster maker, crochet toy,
   photo camera, horse riding in the park, library of "what I'm learning".
6. **Arcade Pier game**: "Full Stack" — one-tap block stacking game, blocks labelled HTML → CSS → JS →
   React → Node → MongoDB…, leaderboard in MongoDB.
7. **Driving**: pick a car at a garage (Kenney Car Kit, Ecctrl vehicle module `ecctrl/vehicle`),
   metro/fast travel between districts.
8. **Admin dashboard + data**: `/admin` (Auth.js, only `wouroudelkhaldi@gmail.com`), content in MongoDB
   Atlas M0 validated by `src/content/schema.ts`, served via static generation + on-demand revalidation
   so visitors never wait on the database (seed.ts stays as the fallback). Media (paintings,
   screenshots, videos) on **Cloudflare R2**, compressed on upload. Live 3D preview of a building
   while editing. Draft/publish.
9. **Weather**: rain/snow/fog toggles (instanced particles), wet look at night.
10. **Mobile**: Ecctrl `Joystick`/`VirtualButton` from `ecctrl/input`, quality presets.
11. **Polish/perf**: label batching, LOD, KTX2/Draco compression via gltf-transform, loading screen
    that preloads while the welcome screen is shown, SEO metadata, Vercel deploy.

---

## 6. Gotchas (each cost time already)

- **Next.js 16 differs from older versions**: read `node_modules/next/dist/docs/` before using
  unfamiliar APIs (see AGENTS.md). `next dev` rewrites AGENTS.md; that's expected.
- **Ecctrl v2 does not read the keyboard**: Player.tsx reads drei `useKeyboardControls` and calls
  `controller.setMovement(keys)` every frame. Camera follow is manual (`EcctrlCameraControls.moveTo`).
- **Physics timestep must stay fixed** (`<Physics>` default). `timeStep="vary"` launched the player
  hundreds of meters into the air on the first frame.
- **Player feet offset**: `FEET_OFFSET = capsuleHalfHeight + capsuleRadius + floatHeight + 0.06`.
- **Facing**: characters face +z in model space. The controller's `currQuat` forward is not the
  model's facing; use the hijab hood or movement direction to find the front.
- **Lint**: the React Compiler rule `react-hooks/immutability` is turned off for
  `src/components/city/**` (three.js objects are mutated per frame by design). Other compiler
  rules still apply (no refs read during render, no `Math.random` in render/memo).
- **Windows shell**: inline `node -e '...'` breaks on apostrophes in strings/comments. Write edit
  scripts to `.assets-src/*.cjs` files and run them.
- **Quaternius files** come from Poly Pizza (`https://static.poly.pizza/<uuid>.glb`); their Google
  Drive downloads are quota-blocked. Kenney zips download directly from kenney.nl.
- **Skinned "fabric layers"** (`addSkinLayer`) copy triangles whose dominant bone matches a region
  and bind them to the same skeleton — this is the reliable way to make sleeves/necklines fit.
  Don't go back to cylinder sleeves (the user said they rendered wrong).
- Dev debug handles: `window.__city` (`state.get()` gives camera/scene/controls; `playerPosition`),
  `window.__player.current` (Ecctrl handle; `.body.setTranslation(...)` to teleport).
  The camera controls clamp distance to ≥ 3 m; narrow `camera.fov` to "zoom" for close-ups.

---

## 7. Assets & licenses

- Kenney Nature Kit, Car Kit (CC0) — `public/models/nature`, `public/models/cars` (+ LICENSE.txt)
- Quaternius adult characters (CC0, via Poly Pizza) — `public/models/people` (+ LICENSE.txt)
- Microsoft Rocketbox avatars + animations (MIT) — `public/models/rb` (+ LICENSE.txt)
- Quaternius Universal Base Characters / Animation Library (CC0) — `public/models/people2` (unused now)
- Poly Haven sky HDRI (CC0) — `public/env`
- Everything else (landmarks, buildings, rooms, textures, sounds) is procedural code.
