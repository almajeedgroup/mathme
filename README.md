# MathMe 3D Studio

**Generative 3D Art & Object Studio**: a browser-based 3D creation tool for students (written with 10th graders in mind).

You build objects from simple shapes, described in plain words like *width*, *height*, *depth* and *radius*. Then math places hundreds or thousands of copies for you, in spirals, grids, circles, waves, rings, spheres, mirror symmetry or random scatters. The app shows the formulas behind every pattern and shape, using your own numbers. When you're done, export the result as **GLB, STL, OBJ, PNG or a PDF project sheet**.

> The example from the [project brief](docs/Generative%203D%20Art%20%26%20Object%20Studio.pdf) works as a typed recipe:
> `100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2`

The full design and milestones are in [docs/PLAN.md](docs/PLAN.md).

## Features

- **20 shapes with student-friendly sizes**
  - Basic: cuboid, sphere, cylinder/frustum, cone, torus, flat sheet.
  - Solids: pyramid, prism, capsule, the Platonic solids, torus knot.
  - "Make your own":
    - **spun shapes** (a lathe: draw half an outline)
    - **extruded outlines** (stars, hearts…)
    - **3D text**
    - **graph surfaces** `y = f(x, z)`
    - **parametric surfaces** (Möbius strip, sea shell…)
- **Math patterns**
  - The patterns: spiral, helix and sunflower (golden angle); grid; circle/arc; waves and ripples; radial rings; Fibonacci sphere/dome; seeded random scatter.
  - Every copy can vary in size (grow, random, pulse), spin, tilt, wobble, jitter and colour (gradient, rainbow, random).
  - Mirror and kaleidoscope symmetry work on anything.
- **Learn & Measure**
  - Each pattern explains its formulas and works them out for any object you click.
  - Each shape shows its volume and surface-area formulas with your numbers put in.
- **Recipe box**: type `200 cones → sphere → radius 10 → rainbow` and press Enter.
- **Reusable shapes**: group shapes, save them as "my shape", then use that as the source of a pattern.
- **Undo/redo, autosave and ideas**
  - Undo and redo work on everything.
  - Your work is autosaved in the browser.
  - Project files can be saved and opened.
  - There are 11 ready-made ideas: DNA, sunflower, spiral staircase, atom, snowflake…
- **Exports, all made in the browser**
  - **GLB**, in metres.
  - **STL**, in millimetres for 3D printers.
  - **OBJ**.
  - **PNG**, up to 4K, with an optional see-through background.
  - A **PDF project sheet**: your picture, front/top/side views, every setting, and the maths with measurements.
- **Optional Python geometry service**
  - Exact whole-model measurements, with overlaps removed.
  - **Join / Cut / Overlap** (boolean operations).
  - Print-ready, joined STL/3MF/OBJ/PLY files.

## Human heart slice atlas (for teaching cardiovascular anatomy)

MathMe includes a **real, scan-derived human heart**: the Human Reference Atlas male reference heart, with 51 named structures (chambers, valves, septum, papillary muscles, aorta and branches, pulmonary vessels, venae cavae, coronary arteries and veins). It is licensed CC BY 4.0, with attribution in `geometry-service/data/heart/ATTRIBUTION.md`.

- **In the app:** open Ideas → "Human heart (real anatomy)" and press the scissors in the 3D view.
  - Pick a standard view (four-, two- or three-chamber, or short axis at the base, mid or apex), an axial, coronal or sagittal plane, or set any angle.
  - "Export this cut" saves both halves with closed cut faces (needs the geometry service).
  - File → Import 3D model lets you cut your own GLB/STL/OBJ models the same way.
- **The atlas build** cuts the heart along 21 planes:

  ```bash
  cd geometry-service
  pip install -e .[anatomy]
  python -m app.anatomy.build --out dist/heart
  ```

  It writes:
  - the whole heart (GLB, OBJ, STL)
  - for every plane, one GLB with both halves as named groups, and a printable STL per half
  - labelled cross-section pictures with a 10 mm scale bar
  - `planes.json` with the plane equations, landmarks and cut areas
  - a ~50-page **PDF atlas** with renders, the maths, structure tables and teaching notes

The atlas is for **education only**. It shows one reference heart and is not a patient record or surgery report. Its teaching notes should be reviewed by a qualified cardiothoracic surgeon before use in a course.

## Repository layout

| Path | What it is |
| --- | --- |
| `web/` | The web app: Vite + React + TypeScript + react-three-fiber + Mantine |
| `web/src/engine/` | Pure TypeScript math engine: shapes, formulas, patterns, variation, symmetry, the recipe parser and the project schema |
| `web/src/viewport/` | The 3D view (instanced rendering, selection, move/turn/stretch gizmo) |
| `web/src/ui/` | Editor panels, dialogs and actions |
| `web/src/export/` | GLB/STL/OBJ/PNG/PDF and project-file export |
| `geometry-service/` | Python FastAPI service (trimesh + manifold3d): measurements, booleans, print-ready exports |
| `docs/` | Project brief and implementation plan |

## Quick start

### Web app

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

### Geometry service (optional)

The service adds the Join/Cut/Overlap tools, "Measure everything" and print-ready exports.

```bash
cd geometry-service
python3 -m venv .venv && . .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8000
```

The web dev server forwards `/api/*` to `http://localhost:8000`. Without the service, everything else still works (including all exports). The service-only buttons are greyed out with a hint.

### Both with Docker

```bash
docker compose up    # web on :5173, service on :8000
```

## Checks

```bash
# web: lint, format, types, unit tests, build, browser tests
cd web
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npm run e2e                     # uses the preinstalled Chromium
E2E_SERVICE=1 npm run e2e       # also starts the geometry service for its tests

# geometry service
cd geometry-service
ruff check . && ruff format --check . && pytest
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push.

## Configuration

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `VITE_GEOMETRY_API_URL` | web build | `/api` | URL of the geometry service in production, e.g. `https://geometry.example.org` |
| `VITE_BASE` | web build | `/` | Sub-path the app is served from, e.g. `/mathme/` for GitHub Pages |
| `GEOMETRY_SERVICE_URL` | web dev/preview | `http://localhost:8000` | Where the `/api` proxy forwards to |
| `ALLOWED_ORIGINS` | service | `http://localhost:5173,http://localhost:4173` | Comma-separated web origins allowed to call the service (CORS) |
| `MAX_UPLOAD_MB` | service | `50` | Largest upload |
| `MAX_TRIANGLES` | service | `2000000` | Largest model |
| `MAX_UNION_PARTS` | service | `5000` | Most parts joined in one request |
| `REQUEST_TIMEOUT_S` | service | `60` | Time limit per request |

## Deployment

The two parts are deployed separately:

- **Web app**: a static site. Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages, a school web server).
  1. Run `cd web && VITE_GEOMETRY_API_URL=https://your-service-url npm run build`.
  2. Publish `web/dist/`.
  3. For a sub-path, also set `VITE_BASE=/your-path/`.
- **Geometry service (optional)**: a small Docker container that keeps no data.
  1. Build `geometry-service/Dockerfile`.
  2. Run it on any container host (Render, Fly.io, Railway, Cloud Run…).
  3. Set `ALLOWED_ORIGINS` to the web app's URL.

Projects are stored only in each student's browser (and in the project files they download), so no accounts or database are needed.

## Third-party assets

The 3D text font is Droid Sans Bold (Apache License 2.0), trimmed to ASCII. See `web/src/assets/fonts/DROID-NOTICE.txt`.
