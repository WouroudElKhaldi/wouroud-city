# Wouroud's City

The 3D portfolio of **Wouroud El Khaldi**, Mid-Senior Full Stack Software Engineer (Tripoli, Lebanon).

Instead of scrolling a page, you walk a small city. Central Plaza connects eight districts, and every
building in them is generated from portfolio data:

| District | What's inside |
| --- | --- |
| Business District | Work experience: floors = months worked, glass HQ towers |
| Skill Downtown | One tower per skill, height = level, each with its own shape and 3D logo |
| Project Harbor | One warehouse per project, tinted in its brand color |
| Campus | Studies |
| Training Park | Certificates, bootcamp and scholarship pavilions |
| Polyglot Quarter | Arabic, English, French |
| Hobby Quarter | Art studios, and an easel where you can paint and save your picture |
| Arcade Pier | **Full Stack**, a block-stacking game (HTML → CSS → JS → React → Node…) |

Recruiters can skip straight to the 2D résumé at `/resume` or download the PDF CV.

## Features

- Third-person character (girl with optional hijab and modest outfits, guy, or robot)
- Welcome screen with personas: recruiter, developer or visitor, each with its own guided tour
- Round districts: central plaza and fountain, park, ring road with traffic, clustered buildings, market stalls
- Every building is unique: rooftop emblem, brand color and silhouette per skill / project / job
- Info panels with cross-links (tech → skill tower → projects and jobs that use it)
- Minimap and full map with click-to-navigate waypoints
- Day / night, rain / snow / fog, night spotlight
- Lots to play with: trees, flowers, balls, cones, pigeons, cars, lamps, fountain coins, benches, NPC chat
- Phones: joystick, jump and action buttons, compact HUD, lighter graphics preset
- SEO: Open Graph image, sitemap, robots, JSON-LD

## Controls

| Desktop | Phone |
| --- | --- |
| `W A S D` / arrows: walk, `Shift`: run, `Space`: jump | Joystick (push to the edge to run), jump button |
| `E`: interact, `M`: map, `Esc`: close | Action button, tap the minimap |
| Drag: look, scroll: zoom | Drag: look, pinch: zoom |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit   # type-check
npx eslint src     # lint
```

Set `NEXT_PUBLIC_SITE_URL` in production so share links and the sitemap use the real domain.

## Stack

Next.js 16 (App Router) · TypeScript · React Three Fiber · drei · Rapier physics · Ecctrl character
controller · Zustand · Zod · @react-three/postprocessing · Tailwind CSS 4.

All content lives in `src/content/seed.ts`, validated by `src/content/schema.ts`. The world is pure
data → layout (`src/world/`) → components (`src/components/city/`). See `HANDOFF.md` for the
architecture and `tasks.md` for the roadmap.

## Credits

- Characters: [Quaternius](https://quaternius.com) (CC0)
- Nature and cars: [Kenney](https://kenney.nl) Nature Kit and Car Kit (CC0)
- Everything else (landmarks, buildings, emblems, hijab, sounds) is generated in code.
