# MathMe 3D Studio

**Generative 3D Art & Object Studio**: a browser-based 3D creation tool for students.
Build objects from simple shapes (described with plain words like *width*, *height* and *depth*).
Then let math place hundreds or thousands of copies: spirals, grids, circles, waves, spheres, symmetry and more.
Export the result as **GLB, STL, OBJ, PNG or a PDF project sheet**.

> Example from the [project spec](docs/Generative%203D%20Art%20%26%20Object%20Studio.pdf):
> `100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2`

See [docs/PLAN.md](docs/PLAN.md) for the full design and milestones.

## Repository layout

| Path | What it is |
| --- | --- |
| `web/` | The web app: Vite + React + TypeScript + react-three-fiber + Mantine |
| `web/src/engine/` | Pure TypeScript math engine (patterns, shapes, formulas, command parser), unit-tested |
| `geometry-service/` | Python FastAPI service (trimesh + manifold3d): measurements, boolean operations and print-ready exports |
| `docs/` | Project spec and implementation plan |

## Quick start

### Web app

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

### Geometry service (optional; enables Combine/Cut tools, whole-model measurements and print-ready exports)

```bash
cd geometry-service
python3 -m venv .venv && . .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8000
```

The web dev server proxies `/api/*` to `http://localhost:8000`.
Without the service, the rest of the app (including GLB/STL/OBJ/PNG/PDF export) still works.

### Both with Docker

```bash
docker compose up
```

## Checks

```bash
# web
cd web && npm run lint && npm run typecheck && npm test && npm run e2e
# geometry service
cd geometry-service && ruff check . && pytest
```
