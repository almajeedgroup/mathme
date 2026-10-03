# Plan: Build "Generative 3D Art & Object Studio" as a web app

## Context

The repo (`almajeedgroup/mathme`) contains only a one-page spec, `Generative 3D Art & Object Studio (1).pdf`. It describes a browser-based 3D creation tool for beginners. Users build objects from primitives (cube, sphere, cylinder, cone, torus, plane, custom shapes). They then use a **math generation engine** (spiral, grid, circle, wave, radial, sphere, symmetry, random) to place hundreds or thousands of copies automatically. Example from the spec: `100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2`. Users can preview the result in 3D, edit it, and export it as **GLB**.

User decisions in planning:
- **Stack:** Vite + React + TypeScript + react-three-fiber (R3F) + drei + Zustand. The math engine stays plain TypeScript, separate from React.
- **Python:** a **geometry service** (FastAPI + trimesh + manifold3d) for heavy work: boolean operations (union, cut, intersect), mesh merging and repair, measurements, and print-ready STL/OBJ/3MF export.
- **Audience:** **10th-grade students.** Shapes are defined in plain terms (Width, Height, Depth/Breadth, Radius, "How many?", "Turn per object"). The app shows the math behind each pattern and shape.
- **Custom shapes:** all of the following: math parametric surfaces, lathe/extrude profiles, compound groups (reusable as a pattern source), and extra built-in solids.
- **Exports:** GLB, PNG, PDF (a printable project sheet), STL, OBJ, and the project JSON file.

## Architecture

```
mathme/
  web/                      Vite + React + TS app (static hosting)
    src/engine/             pure TS, no React; unit-tested core
    src/state/              Zustand stores (project, ui), undo/redo, autosave
    src/viewport/           R3F scene, instanced rendering, gizmos
    src/ui/                 Editor panels (Mantine components)
    src/export/             GLB / STL / OBJ / PNG / PDF / project JSON
    src/services/geometryApi.ts   client for the Python service
  geometry-service/         FastAPI + trimesh + manifold3d (Docker)
  docker-compose.yml        web dev server + geometry service
  .github/workflows/ci.yml  web: lint/typecheck/vitest/build/playwright · service: ruff/pytest
  docs/PLAN.md              this plan, committed
```

**Web libraries:** `three`, `@react-three/fiber`, `@react-three/drei` (OrbitControls, TransformControls, Grid, GizmoHelper, Text3D), `zustand` + `immer` + `zundo` (undo/redo), `zod` (project schema), `mathjs` (safe formula parsing, no `eval`), `@mantine/core` (sliders, number inputs, color pickers, tabs, modals), `jspdf`. Three.js add-ons: `GLTFExporter`, `STLExporter`, `OBJExporter`, `ParametricGeometry`, `BufferGeometryUtils.mergeGeometries`.

### 1. Data model (`web/src/engine/types.ts`, `project/schema.ts`)
A versioned, JSON-serializable `Project { version, units, nodes[], library[] }` validated with zod, with a `migrate.ts` for future versions. Node kinds:
- **ShapeNode**: `{ shape: ShapeDef, transform, material, visible }`
- **PatternNode**: `{ source: ShapeDef | { groupRef }, pattern: { type, params }, count, variation, symmetry?, seed, transform, material }`
- **GroupNode**: `{ children[] }`. "Save as custom shape" adds the group to `library[]` so a pattern can use it as its source.

`ShapeDef` is a discriminated union over `box | sphere | cylinder | cone | torus | plane | torusKnot | icosahedron | dodecahedron | octahedron | capsule | lathe | extrude | text3d | graphSurface | parametric`.

### 2. Shapes registry (`web/src/engine/shapes/`)
Each shape entry has:
- **Student-friendly fields**, each with a label, unit, min/max/default and a tooltip. Examples: Box = Width × Height × Depth; Cylinder = Radius (top/bottom), Height; Torus = "Ring size", "Tube thickness"; "Smoothness" instead of "segments".
- `buildGeometry(def)`, memoized by a hash of the parameters.
- `formulas` for volume and surface area (e.g. V = πr²h), with the student's numbers substituted ("show working").

Custom shapes:
- **Graph surface** (the easy mode): `y = f(x, z)`, e.g. `sin(x)*cos(z)`, over an x/z range.
- **Parametric** (advanced): `x(u,v), y(u,v), z(u,v)` with u/v ranges.
  - Formulas are compiled through `engine/expr.ts`, using mathjs with an allow-list of functions and variables.
  - Presets: Möbius strip, sea shell, wave sheet, saddle.
- **Lathe and extrude**: a 2D `ProfileEditor` where students click points, plus presets (vase, bowl, goblet, star, heart). Extrude has depth and bevel. **3D Text** is an extrude preset.
- **Compound groups**: select several objects → Group → "Save as custom shape".

### 3. Generation engine (`web/src/engine/patterns/`, `variation.ts`, `modifiers/symmetry.ts`, `layout.ts`)
- **Pure functions.** `generate(params, count, rng) → Placement[]`, where a placement holds position, rotation, scale and `t` (0..1 along the sequence).
- **Seeded RNG** (`rng.ts`, mulberry32), so results are reproducible.
- **Pattern registry.** Each pattern has student-labelled params and a `mathExplanation` for the **Learn ("Show the math") panel**. The patterns:
  - **Spiral**: θᵢ = i·turn, rᵢ grows with i or stays fixed (helix), yᵢ = i·rise. Includes a "Sunflower" option (golden angle 137.5°, r = c√i).
  - **Grid**: columns × rows × layers, with spacing.
  - **Circle**: θᵢ = 2πi/n, with a "face the center" option.
  - **Wave**: a grid with y = A·sin(2πx/λ + phase).
  - **Radial**: concentric rings.
  - **Sphere**: points spread evenly over a sphere (Fibonacci sphere).
  - **Random**: seeded, inside a box or a sphere.
- **Variation** (shared by all patterns):
  - Size ramp from → to: linear, random or wave.
  - Turn per object in degrees, plus tilt.
  - Face outward or face the center.
  - Color gradient from → to.
  - Jitter.
- **Symmetry modifier**: mirror across X/Y/Z and/or N-fold rotational copies ("kaleidoscope"). It works on shape and pattern nodes.
- **Limits**: a warning above 5,000 objects and a hard cap of 20,000.

### 4. Command bar (`web/src/engine/command/parser.ts`, `ui/CommandBar.tsx`)
The command bar parses the spec's text style into a PatternNode.
- It accepts `→`, `>` or `,` as separators.
- Keywords: `<n> objects|spheres|cubes…`, pattern name, `radius`, `rotation|turn`, `scale|size a–b`, `spacing`, `height`, `color red to blue`, `seed`.
- Unknown words get a friendly error that highlights the word.
- A test checks that the spec's exact example gives count=100, spiral, radius 20, turn 30°, size 0.5→2.

### 5. State (`web/src/state/`)
- **`projectStore`** (Zustand + immer + zundo): add, update, duplicate, delete, group, ungroup and reorder nodes, with undo/redo (Ctrl+Z / Ctrl+Y).
- **`uiStore`**: selection, open panels, units (mm/cm/m).
- **`persistence.ts`**: debounced localStorage autosave, plus project JSON save/load (validated with zod).

### 6. Viewport (`web/src/viewport/`)
- **Canvas**: `<Canvas frameloop="demand">` with simple local lights (no CDN-fetched HDRIs), a drei `<Grid>`, `<OrbitControls makeDefault>` and a `<GizmoHelper>` view cube.
- **`PatternInstances`**: one `InstancedMesh` per pattern, or one per part when the source is a compound group (matrix = pattern placement × part transform). It uses `instanceColor` for gradients, and recomputes matrices in `useMemo` from `layout.ts`.
- **Selection**: click selects through raycasting (including the instance id). `<TransformControls>` moves, rotates and scales the selected node.

### 7. Editor UI (`web/src/ui/`, Mantine)
- **Toolbar**: add shape, add pattern, undo/redo, Learn, Export.
- **Left side**: a shape library (with custom shapes) and an outliner.
- **Right side**: an inspector with tabs for Shape, Pattern, Variation, Symmetry and Color/Material. Every number has a slider plus an input and shows its unit.
- **Panels**: a Measurements panel (formulas with working; whole-model figures from the Python service when it is online) and a Learn panel.
- **Getting started**: a presets gallery (Spiral staircase, Sunflower, DNA helix, Atom, Wave field, Snowflake, Vase) and a 3-step first-run tour.
- **Layout**: responsive, so it also works on tablets.

### 8. Exports (`web/src/export/`)
All exports run in the browser and work offline.
- **`buildExportScene.ts`** bakes instances into named meshes ("Spiral_001"…), or merges each node into one mesh (an option). It also converts units: glTF uses meters, STL uses mm.
- **GLB**: `GLTFExporter` with `binary: true`.
- **STL / OBJ**: the matching Three.js exporters.
- **PNG**: renders at 1×, 2× or 4× through an offscreen render target, with an optional transparent background.
- **PDF** (jsPDF "project sheet"):
  - Page 1: title, student name and a large perspective render.
  - Page 2: front, top and side orthographic views, a parameter table, the formulas used and the measurements.
- **Project JSON**: the project file, which can be reopened.

### 9. Python geometry service (`geometry-service/`)
FastAPI, `trimesh`, `manifold3d`, `numpy`, `python-multipart`. The service is stateless; the client uploads GLB (built from `buildExportScene`).
- `GET /health`
- `POST /analyze`: GLB → `{ volume, surface_area, bbox, is_watertight, triangle_count }`.
- `POST /boolean`: two GLBs + `union | difference | intersection` → GLB. This powers the "Combine" and "Cut a hole" tools.
- `POST /export`: GLB + format (`stl | obj | ply | 3mf`), plus merge/repair/unit options → a print-ready file.

Hardening: an upload size limit (50 MB), a triangle cap, request timeouts and CORS restricted to the web origin.

Integration:
- `services/geometryApi.ts` talks to the service. Vite proxies `/api` to `localhost:8000` in development.
- If the service is offline, its buttons are disabled with a "Geometry service offline" tooltip; client-side exports still work.
- `Dockerfile` and `docker-compose.yml` cover local and hosted runs.

## Milestones (each one is committed and pushed to `claude/charming-meitner-31cpmi`)

| # | Milestone | What it adds |
|---|---|---|
| **M0** | Scaffold | Monorepo layout, Vite + React + TS, ESLint/Prettier, Vitest, Playwright, FastAPI skeleton, docker-compose, GitHub Actions CI, README, `docs/PLAN.md` |
| **M1** | Basic shapes | Viewport; the 6 basic primitives with W/H/D-style inspector fields; selection and transform gizmos; colors; per-shape formulas |
| **M2** | Generation engine | All 7 patterns, variation, instanced rendering, Learn panel, engine unit tests |
| **M3** | Custom shapes | Extra solids, graph and parametric surfaces, lathe/extrude ProfileEditor, 3D text, compound groups as a pattern source, symmetry modifier |
| **M4** | Editing workflow | Command bar, presets gallery, undo/redo, autosave, project JSON |
| **M5** | Client exports | GLB, PNG, PDF project sheet, STL, OBJ |
| **M6** | Python service | `/analyze`, `/boolean`, `/export`, pytest; frontend integration (Combine / Cut tools, Measurements, print-ready export) |
| **M7** | Polish | First-run tour, tooltips and glossary, performance check at 10k instances, accessibility, tablet layout, deployment notes (web on static hosting, service on Docker hosting) |

## Verification
- **Engine unit tests (Vitest)**:
  - Each pattern returns `count` placements.
  - Circle points sit at the given radius.
  - Fibonacci-sphere points have unit length.
  - The same seed gives the same output.
  - Symmetry multiplies the copies correctly.
  - The size ramp's endpoints equal from/to.
  - The command parser handles the spec example plus error cases.
  - zod round-trips the project schema.
  - The formula evaluator rejects JS injection (e.g. `constructor`, `import`).
- **E2E tests (Playwright, using the preinstalled Chromium)**:
  - The app loads.
  - Typing the spec's example command gives an InstancedMesh with 100 instances.
  - Undo removes it again.
  - Export GLB gives a non-empty file that loads back through `GLTFLoader` with 100 meshes.
  - The PNG and PDF downloads are non-empty.
- **Service tests (pytest + httpx TestClient)**:
  - `/analyze` on a 2×3×4 box gives volume 24.
  - The union of two overlapping boxes has a volume equal to their combined volume minus the overlap.
  - `/export` gives a valid STL.
  - Oversized uploads are rejected.
- **Manual checks**: `docker compose up`, then build the spec example and a sunflower preset. Export GLB and open it in an external glTF viewer (e.g. Blender), and print the PDF sheet.
- **CI**: runs all of the above on every push.

## First action after approval
Commit this plan as `docs/PLAN.md`, then implement milestones in order (M0 → M7), with a push after each milestone.
