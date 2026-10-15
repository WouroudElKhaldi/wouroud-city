# Wouroud's City — Tasks

Status legend: ✅ done · 🔄 in progress · ⬜ not started · ⛔ blocked (needs the owner)

Order = the order to build things. Update the status as soon as a task is finished.
See `HANDOFF.md` for architecture, rules and gotchas.

---

## ✅ Done

1. ✅ Phase 0: content schema (Zod) + seed content from CV / LinkedIn / certificates
2. ✅ Next.js 16 + R3F + Rapier + Ecctrl setup, first scene
3. ✅ Hub (Central Plaza) with 8 procedural district landmarks; all 8 districts enterable, generated from content
4. ✅ Day / night cycle: lit windows, lamp light pools, stars, bloom; violet + gold + mint palette
5. ✅ Realistic people: Microsoft Rocketbox avatars (MIT) in modeled clothes with mocap animations; all 40 adults pickable from a thumbnail grid (incl. hijab, niqab, burqa, thobe looks); the custom hijab option and generated clothes are gone
6. ✅ Interactive decor: trees, plants, balls, cones, pigeons, cars, lamps, billboards, fountain, benches, NPC chat
7. ✅ Synthesized sound effects + mute; night spotlight following the player
8. ✅ Welcome screen: personas (Recruiter / Developer / Just visiting) + avatar and look picker
9. ✅ Minimap + full map (M) with click-to-waypoint and a glowing guide path
10. ✅ Building info panels (E at a door or click a building)
11. ✅ 2D résumé page `/resume` + PDF CV download
12. ✅ Résumé page redesign (hero, stats, sidebar, experience timeline, project and certificate cards)

## ⭐ Owner's priority list (open requests, in this order)

P1. ✅ **Loading time**: avatars and clips meshopt-compressed (anim 5.4 MB → 0.9 MB, each avatar 480 KB → 107 KB), only the visitor's own body is preloaded (the crowd streams in), sky light map 1.4 MB → 0.3 MB, and 3D labels use a local font instead of waiting on the jsdelivr CDN (that wait blocked the whole scene). Startup download ~20 MB → ~4.5 MB
P2. ✅ **Realistic outdoors** in the Rocketbox style (not photoreal, no more low-poly toy look): grass, trees and plants, balls/cones/pigeons, streets/sidewalks/curbs/crosswalks, benches/lamps/planters, the ground in the hub and every district. CC0 assets only, small downloads, keep every interaction and instancing, frame rate no worse — DONE: generated CC0 textures (`tools/textures/make_textures.py` → `public/textures`, bark from Poly Haven), procedural trees/plants (`plants.ts`), world-mapped surfaces (`surfaces.ts`), new lawn, balls, cones, crates, pigeons, benches, lampposts, planters, curbs, crosswalk. Frame rate could not be measured here (no GPU in the cloud); instancing kept everywhere, draw calls similar. Check on a real machine
P3. ✅ **Codi Tech building: adventures and activities** with her mentors (they did a lot together), much more fun inside — DONE: `CodiAdventures.tsx` (photo wall with stories, foosball, mentor riddles). Captions are general: **owner to send the real adventures and mentors' names** (edit `ADVENTURES`)
P4. ✅ **Freelance office: fill it** with everything from the freelance work (the projects and things built together) — DONE: `FreelanceStudio.tsx` (Jamrex Miniyeh live on screen: EN/AR, light/dark, Telegram alert; city model; process wall; side projects; desk)
P5. ✅ **Every building in every district enterable AND interactive inside** (not only Business and Projects): skills, campus, training, languages, hobbies, arcade too; each room has things to do — DONE: `ThemedRooms.tsx` (skill lab, lecture hall, certificate gallery, language café, hobby studios, arcade halls); shops via `Shops.tsx`
P5b. ✅ **Arcade Pier games** (owner, 2026-10-15): today only "Full Stack" can be entered. Add: **XO (tic-tac-toe) vs a bot** with Easy / Medium / Hard; a **flying bird between walls** game (flappy style); a **car race against bots** using the city's cars and people. Each game in its own arcade building — DONE: `hud/XoGame.tsx`, `hud/FlappyGame.tsx` (Firewall Flyer), `city/RaceTrack.tsx` + `hud/RaceHud.tsx` (Ring Road Rally); arcade buildings in `layout.ts`
P5c. 🔄 **Hyperfocus studio built from the app itself** (owner, 2026-10-15): everything inside its building comes from Hyperfocus (what it is, its features, the companion pet, the music player…) plus **real screenshots**. The Hyperfocus source is on the owner's laptop, not in the cloud: the local session should take screenshots of the running app and save them as `public/images/projects/hyperfocus/*.png` (the studio shows any images listed in the project's `media`) — BUILT (`HyperfocusStudio.tsx`); **screenshots still to add** from the owner's laptop (put paths in the project's `media`)
P5d. ✅ **A unique interior for every skill** (owner, 2026-10-15): each skill tower's room in that skill's own colors, design and theme, with its own interactive things (React component tree that re-renders, Docker containers to stack, Git branches to commit, SQL tables to query, CSS box model to restyle…) — DONE: `SkillRooms.tsx` (`SKILL_THEMES`: colors, tagline, code, words and one of 14 centerpieces per skill)
P5e. ✅ **Restaurants and cafés you can really use** (owner, 2026-10-15): enter, sit and rest, read the menu, order, the food is served and you eat it — DONE: Mezze House, Shawarma Corner, Pizza & Code added; every shop enterable (`Shops.tsx`, menus in `world/shops.ts`, `hud/MenuCard.tsx`)
P6. 🔄 **Luxury everywhere** (from the interiors pass): walnut/leather/velvet office desks and studio sofas, then the same luxury look outdoors (plazas, benches, lamps, building lobbies) — offices/studios now use the walnut/leather `Furniture.tsx` pieces; outdoor benches (walnut + cast iron + brass) and lamps (black iron + brass) done; **building lobbies still open**
P7. 🔄 Verify the walk-in interiors (Office company wall, a project Studio, sitting on chairs/sofas, leaving by the door), then tick task 22 — checked by screenshots: an office (CodSoft), the skill labs, a café with ordering + eating, Freelance and Hyperfocus studios; still to check: leaving by the door on every room type
P8. ⬜ Check the car rows/spacing in the hub after the car shrink, and the bench sitting pose outdoors
P9. ✅ Crochet toy in the Hobby Quarter (task 25) — the crochet corner in the yarn-shop hobby studio (`CrochetCorner` in `ThemedRooms.tsx`)
P10. ✅ New robot avatar (task 39) — `Avatar.tsx` → `Robot`
P11. 🔄 Jump/fall animations; delete the old character code (clothes.ts, hijab.ts, Hair.tsx, garments.ts, body.ts, Character.tsx, public/models/people*, public/models/hair) — old Quaternius code and models deleted; **jump/fall clips still missing** (Rocketbox has none; consider a Mixamo-free CC0 clip or a procedural pose)
P12. 🔄 Fast travel between districts, wet-ground look in rain, statues / kids playing in plazas — fast travel in the big map (M) and wet ground in rain done; **statues / kids playing still open** (Rocketbox has no children)
P13. ⬜ Batch the skill labels, LOD for far buildings (tasks 35, 36)
P14. ⬜ Listen to the per-district music; check the car rows in the 7 districts other than Business
P15. ⛔ Needs the owner's free accounts: admin, MongoDB, R2 uploads, leaderboard, Vercel deploy (tasks 30–34)

## 🔄 In progress

Next: P5c screenshots (local session), P6 lobbies, P8 car rows / bench pose, P11 jump clip, P12 statues, P13 labels/LOD

## Roadmap (in build order)

### A0. Better 3D design (top priority, owner's request)
40. ✅ District layout redesign: no more one long street. Each district is a round neighborhood: a central square, ring road, buildings grouped in clusters (by category / company / project type), parks, plazas and decor between groups
41. ✅ Unique building per item: every building gets its own design from its data (CSS tower ≠ JS tower, Jamrex ≠ FitSync ≠ Hyperfocus). Signature shapes, roofs, colors, rooftop props and logos per skill / project / job
42. ✅ District-specific architecture: Business = glass towers, Skills = neon downtown, Projects = harbor warehouses and ships, Campus = brick and clock tower, Training = park pavilions, Polyglot = old-town houses, Hobbies = art studios, Arcade = pier with rides
43. ✅ Better people: Rocketbox avatars for the player and the crowd (Person.tsx, /models/rb, converter in .assets-src/rocketbox/tools). Polish left: no jump/fall clip yet (jump shows idle); old unused files clothes.ts, hijab.ts, Hair.tsx, garments.ts, Character.tsx models can be deleted
44. ✅ More life: cars driving the ring road (they stop for you and honk), market stalls, fountain plaza, benches, tree groves, pigeons, walkers (statues and kids playing still open)

### A. Phones and tablets
13. ✅ Responsive HUD on phones: nothing off-screen, compact top bar, smaller minimap, menu sheet for secondary buttons
14. ✅ Touch controls: virtual joystick (walk, push further = run), jump and interact buttons, one-finger drag to look, pinch to zoom
15. ✅ Touch-aware help text (no WASD hints on phones) and a readable full map on small screens
16. ✅ Mobile quality preset: lower DPR and no post-processing on phones (fewer shadows still to try if phones are slow)

### B. First impression
17. ✅ Loading screen with real progress while models load behind the welcome screen
18. ✅ SEO and sharing: Open Graph / Twitter image, metadata, sitemap, robots, JSON-LD Person
19. ✅ README rewrite (what it is, how to run, controls, credits)

### C. Content inside buildings
20. 🔄 Richer info panels: ✅ "used in" links between skills ↔ projects ↔ jobs, ✅ next/previous building; ⬜ project media gallery (needs screenshots from the owner / admin)
21. ✅ Private Vault building explains the private work GitHub
22. 🔄 Real interiors you can walk into: offices for every job and studios for every project are built (InteriorScene.tsx); ✅ Sahme Trading HQ (SahmeHQ.tsx): big floor with lobby, trading floor and 8 departments (Marketing, Sales, Operations, Risk, Accounting, HR, Software Engineering, Financial Counseling), luxury real-size furniture (Furniture.tsx) with seats fitted to the sitting pose and checked in screenshots; ✅ Develeb community hub (DevelebHub.tsx) in the develeb.org design: stage with the typing hero, audience rows, events, jobs, testimonials, newsletter, founders, partners, the website designs and the design desk; ✅ Reltrix products (8 totems), ecosystem and SAHMEE Group in the Sahme HQ; ✅ Codi Tech campus; ✅ Life Sculptor hub; ⬜ other offices/studios onto the new furniture

### D. Play
23. ✅ Arcade Pier game "Full Stack": one-tap block stacking with tech labels (HTML → CSS → JS → React → Node → MongoDB…), local best score
24. ✅ Hobby Quarter: painting easel (2D canvas painting app in the gallery)
25. 🔄 Hobby Quarter: ✅ photo camera (📸 Photo in the HUD and the Photo Studio, saves a captioned PNG), ✅ library shows what she is learning now; ⬜ gallery of her paintings (needs uploads), ⬜ crochet toy
26. ✅ Horse riding: a horse waits by the stables in the Hobby Quarter; ride, gallop with Shift, the camera follows behind
27. ✅ Weather: rain / snow / fog toggle in the HUD (particles follow the player, fog eases in); wet ground look still open
28. ✅ Driving: all six cars parked in the hub lot and in every district (avenue curb + walkway bays); wheels roll and steer, the driver door swings open and shut getting in and out (CarModel.tsx); W/S/A/D or joystick, Shift boost, Space brake, E to get out; cars stay where you park them (fast travel still open)
29. ✅ Ambient music per district (synthesized, mute-aware, slower at night, rain hiss) — runs without errors, not yet listened to by a human

### E. Data and admin (needs free accounts created by the owner)
30. ⛔ Admin dashboard `/admin` (Auth.js, only the owner's Google account)
31. ⛔ Content in MongoDB Atlas M0, validated by the Zod schema, static generation + on-demand revalidation (seed.ts stays as fallback)
32. ⛔ Media uploads to Cloudflare R2 (paintings, screenshots, videos), compressed on upload
33. ⛔ Arcade leaderboard in MongoDB
34. ⛔ Deploy on Vercel Hobby + custom domain

### F. Polish and performance
35. ⬜ Batch / bake troika text labels (skills district has ~43)
36. ⬜ LOD for far buildings, KTX2 / Draco compression of models (gltf-transform)
37. ✅ Accessibility: reduced motion (CSS + still emblems), info panels are focused dialogs, screen-reader summary with a résumé link
38. ✅ Character polish: superseded by the Rocketbox avatars
39. ⬜ New robot avatar (current one is the old procedural model)
