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

## 🔄 In progress

_(nothing; next up: 43 Better people)_

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
22. ⬜ Real interiors you can walk into (start with the HQ / Sahme Trading and one project building)

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
