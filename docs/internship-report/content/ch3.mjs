// Chapter III: Experiential Learning.
import { BREAK, CHAPTER, CODE, FIG, H2, H3, P, TABLE, UL } from './blocks.mjs';

const BL = '';

export const chapter3 = [
  { t: 'page', kind: 'body' },
  CHAPTER('CHAPTER III', 'EXPERIENTIAL LEARNING'),
  P(
    'This chapter describes the work carried out during the internship and the learning gained from it. It begins with the weekly work log, then follows the stages of the software development life cycle: requirement analysis, system design, implementation of each module, and testing. It ends with the security measures taken and a summary of what was learnt.',
  ),
  H2('3.1', 'Weekly Work Log'),
  P(
    'The internship was planned as ten weeks of part-time work, about nine hours a week, for a total of 90 hours. Table 3.1 lists the work done in each week. The dates and the hours actually spent are filled in by hand and signed off by the guide.',
  ),
  TABLE(
    '3.1',
    'Weekly work log',
    ['Week', 'Dates', 'Work done', 'Hours'],
    [
      ['1', BL, 'Studied the project brief; wrote the plan; set up the repository, React + TypeScript + Vite, Python service, linting, tests and continuous integration', BL],
      ['2', BL, 'Built the maths engine: shapes described by width, height and radius; the seven patterns; variation and symmetry; formulas for the Learn panel', BL],
      ['3', BL, 'Built the 3D view with instanced rendering, selection and the move/turn/stretch gizmo; the editor panels; undo and redo', BL],
      ['4', BL, 'Added custom shapes (spun and extruded outlines, 3D text, graph surfaces), the plain-language recipe box, the ideas gallery, autosave and project files', BL],
      ['5', BL, 'Implemented exports: GLB, STL, OBJ, PNG and the PDF project sheet; started the Python geometry service (measure, join, cut)', BL],
      ['6', BL, 'Finished the geometry service and print-ready exports; built the human-heart slice atlas and the any-angle cut tool', BL],
      ['7', BL, 'Redesigned the interface in the brand colours; sidebar, settings page and logo; home page with project list and chat box; landing page', BL],
      ['8', BL, 'Added the pencil tool and the 2D sketch board (points, lines, circles, measurements, rules, SVG/PNG/PDF/DXF export, 2D-to-3D)', BL],
      ['9', BL, 'Built the account service: Google sign-in, cloud saves, plans and limits, Cashfree checkout, GST invoices, Campus licences and the owner dashboard', BL],
      ['10', BL, 'Security review and fixes; browser tests for every flow; deployment guide, policy drafts, landing pricing; this report', BL],
      ['', '', '**Total**', '**90**'],
    ],
    [0.08, 0.16, 0.64, 0.12],
  ),
  H2('3.2', 'Requirement Analysis'),
  P(
    'The requirements were collected from the project brief, from the needs of the target users described in Chapter II, and from the business plan. They are divided into functional requirements (what the system must do) and non-functional requirements (how well it must do it).',
  ),
  H3('3.2.1', 'Functional Requirements'),
  TABLE(
    '3.2',
    'Functional requirements',
    ['ID', 'Requirement'],
    [
      ['FR1', 'The user can create, open, rename, duplicate and delete projects; projects save automatically.'],
      ['FR2', 'The user can add shapes described by plain measurements (width, height, depth, radius).'],
      ['FR3', 'The user can copy a shape into a spiral, grid, circle, wave, radial rings, sphere or random-scatter pattern.'],
      ['FR4', 'The system shows the formula of each pattern and a worked example for any chosen object.'],
      ['FR5', 'The system works out the volume and surface area of shapes and of the whole model, with working.'],
      ['FR6', 'The user can type a recipe such as “100 spheres → spiral → radius 20” to build a scene.'],
      ['FR7', 'The user can draw shapes with a pencil and sketch in 2D with lines, circles and rules.'],
      ['FR8', 'The user can export GLB, STL, OBJ, PNG, PDF, SVG and DXF files and a project file.'],
      ['FR9', 'The user can open a real human-heart model and cut it along standard or custom planes.'],
      ['FR10', 'The user can sign in with Google and save projects in the cloud.'],
      ['FR11', 'The system enforces the limits of each plan and explains which plan unlocks a feature.'],
      ['FR12', 'The user can buy a plan; the system adds GST, takes payment through Cashfree and issues an invoice.'],
      ['FR13', 'Teachers and students can join a class with a code; students can share projects with their class.'],
      ['FR14', 'The owner can see sign-ups, revenue and churn, answer enquiries and manage school licences.'],
    ],
    [0.1, 0.9],
  ),
  H3('3.2.2', 'Non-functional Requirements'),
  TABLE(
    '3.3',
    'Non-functional requirements',
    ['Quality', 'Requirement'],
    [
      ['Usability', 'Plain words instead of technical terms; every control has a short help text; works for a 10th-grade student'],
      ['Performance', 'Smooth 3D view with thousands of objects (instanced rendering); first screen loads quickly'],
      ['Portability', 'Runs in any modern browser on Windows, macOS, Linux, Chromebooks and tablets; no installation'],
      ['Reliability', 'Autosave, undo/redo, version checks on cloud saves; payments processed exactly once'],
      ['Security', 'Secure sign-in, signed payment webhooks, protection against cross-site requests'],
      ['Maintainability', 'Typed code, small modules, one source of truth for prices, automated tests'],
      ['Compliance', 'GST invoices numbered per financial year; refund, privacy and terms pages'],
      ['Accessibility', 'Keyboard support, labelled controls, readable colours, layouts that fit a phone screen'],
    ],
    [0.22, 0.78],
  ),
  H3('3.2.3', 'Hardware and Software Requirements'),
  TABLE(
    '3.4',
    'Hardware and software requirements',
    ['Item', 'For using MathMe', 'For developing MathMe'],
    [
      ['Processor', 'Any dual-core processor', 'Quad-core processor'],
      ['Memory', '4 GB RAM', '8 GB RAM or more'],
      ['Graphics', 'WebGL-capable graphics', 'WebGL-capable graphics'],
      ['Operating system', 'Any (Windows, macOS, Linux, ChromeOS)', 'Windows, macOS or Linux'],
      ['Software', 'Chrome, Edge, Firefox or Safari', 'Node.js 22, Python 3.11+, Git, VS Code'],
      ['Network', 'Internet for the first load; cloud features need a connection', 'Internet for packages and deployment'],
    ],
    [0.2, 0.4, 0.4],
  ),
  H2('3.3', 'System Design'),
  H3('3.3.1', 'System Architecture'),
  P(
    'MathMe follows a **three-tier, service-based architecture** (Figure 3.1). The **presentation tier** is the web application running in the browser. It contains the whole maths engine, so the studio works even without a server, and it keeps device projects in browser storage.',
  ),
  P(
    'The **application tier** has two services, each with a narrow job:',
  ),
  UL([
    'the **account service**, a FastAPI application designed to run as a Cloudflare Python Worker, which handles sign-in, cloud projects, plans, payments and school licences;',
    'the **geometry service**, a FastAPI application in a Docker container, which performs heavy and exact geometry work with trimesh and manifold3d.',
  ]),
  P(
    'The **data tier** is Cloudflare D1 (an SQLite database) for records and R2 for project files. External services are Google (sign-in), Cashfree (payments) and Resend (email).',
  ),
  P(
    'The browser talks only to the account service, under the same web address (/api/*). The account service checks the user’s plan and daily quota before passing a geometry job to the geometry service with a shared secret, so the quotas cannot be bypassed.',
  ),
  FIG('3.1', 'System architecture of MathMe', 'architecture', 0.98),
  H3('3.3.2', 'Data Flow Diagrams'),
  P(
    'The **context diagram (Level 0 DFD)** in Figure 3.2 shows MathMe as a single process and its five external entities: the student or maker, the teacher, the owner, Google, and Cashfree/Resend. Students send shapes, patterns, recipes and sketches, and receive the 3D view, formulas and exported files. Teachers send join codes and receive the class page. The owner manages licences and receives metrics. Google confirms identity, and Cashfree reports payment events.',
  ),
  FIG('3.2', 'Context diagram (Level 0 DFD)', 'dfd0', 0.92),
  P(
    'The **Level 1 DFD** in Figure 3.3 breaks the system into seven processes:',
  ),
  UL([
    '1.0 build the scene;',
    '2.0 export files;',
    '3.0 run geometry jobs;',
    '4.0 sign in and save to the cloud;',
    '5.0 billing and GST;',
    '6.0 the Campus class;',
    '7.0 the owner dashboard.',
  ]),
  P('It also shows four data stores:'),
  UL([
    'D1: device projects in the browser;',
    'D2: users and cloud projects;',
    'D3: payments and invoices;',
    'D4: organisations and their members.',
  ]),
  FIG('3.3', 'Level 1 data flow diagram', 'dfd1', 1),
  H3('3.3.3', 'Database Design (E-R Diagram)'),
  P(
    'The account service stores its data in a relational database (SQLite, run as Cloudflare D1 in production). The same SQL migration file creates the tables in both places. Figure 3.4 shows the entity-relationship diagram of the main tables:',
  ),
  UL([
    'A **user** has many sessions, projects, subscriptions, payments and usage counters.',
    'A **payment** has exactly one GST **invoice**.',
    'An **organisation** (a Campus licence) has many members, through the ORG_MEMBERS table, and can make payments.',
    'A **project** can be shared with one organisation.',
  ]),
  FIG('3.4', 'Entity-relationship diagram of the account database', 'er', 0.92),
  TABLE(
    '3.5',
    'Main database tables',
    ['Table', 'Purpose', 'Key fields'],
    [
      ['users', 'People who signed in with Google', 'id, google_sub, email, role'],
      ['sessions', 'Signed-in browsers (stored as a hash of the token)', 'token_hash, user_id, expires_at'],
      ['projects', 'Cloud projects (the file itself is in R2)', 'id, owner_id, version, shared_org_id'],
      ['subscriptions', 'Paid plans and their state', 'plan, period, status, current_period_end'],
      ['payments', 'Every rupee received, with the GST split', 'base, cgst, sgst, igst, total'],
      ['invoices', 'GST invoices numbered per financial year', 'number, payment_id, billing_state'],
      ['usage', 'Daily and monthly counters for plan limits', 'user_id, kind, period, count'],
      ['orgs, org_members, org_codes', 'Campus licences, members and join codes', 'seats, ends_at, role, code'],
      ['enquiries, webhook_events', 'School leads; payment events already handled', 'status; event id'],
    ],
    [0.28, 0.42, 0.3],
  ),
  H3('3.3.4', 'Use Case Diagram'),
  P(
    'Figure 3.5 shows the three kinds of users and what each one can do. The **student** creates and explores; the **teacher** can do everything a student can and also manages a class; the **owner** manages licences, enquiries and the business numbers.',
  ),
  FIG('3.5', 'Use case diagram', 'usecase', 0.92),
  H3('3.3.5', 'Module Structure'),
  P(
    'The source code is organised as a monorepo (Figure 3.6). The maths engine (web/src/engine) has no user-interface code, so it can be tested quickly and reused. The application code is split into the 3D viewport, the user interface, the state stores and the exporters. The two Python services each have their own routes, logic and tests. One shared file (shared/plans.json) holds every price and limit.',
  ),
  FIG('3.6', 'Module structure of the MathMe repository', 'modules', 0.98),

  H2('3.4', 'Implementation'),
  P(
    'This section describes how each module was implemented, with screenshots of the working application and short extracts from the source code.',
  ),
  H3('3.4.1', 'Home Page and Project Management'),
  P(
    'The home page (Figure 3.7) is the first screen after the landing page. A chat box asks “What shall we make today?”: the user can describe an artwork in words, start drawing with the pencil, or choose a recipe. Below it, the user’s projects appear as cards with a small picture of each scene, and a gallery offers ready-made ideas such as a sunflower, a DNA double helix, an atom, a snowflake and the human heart.',
  ),
  P(
    'Each project is stored as a JSON document that follows a versioned schema, checked with the Zod validation library when it is opened. Projects save automatically a moment after every change, and the picture on each card is captured from the 3D view.',
  ),
  FIG('3.7', 'Home page with the chat box, project cards and ideas', 'home', 0.9),
  H3('3.4.2', 'Maths Engine and Patterns'),
  P(
    'The maths engine is the heart of MathMe. A **pattern node** combines a source shape, a pattern type, a count and the pattern’s parameters. When any value changes, the engine calls the pattern’s generate function, which returns a position and an orientation for every copy. Variation rules then change the size, rotation and colour of each copy (for example “scale 0.5–2” or a rainbow of colours), and the symmetry modifier can mirror or rotate the whole result.',
  ),
  P(
    'Every pattern is a small, self-contained definition with its own fields, help texts, default values and an explain function that produces the formulas for the Learn panel. Table 3.6 lists the seven patterns and their core formulas.',
  ),
  TABLE(
    '3.6',
    'Patterns and their formulas',
    ['Pattern', 'Rule for object number i'],
    [
      ['Spiral', 'θ = start + i × step;  r = R × i ÷ (n − 1);  x = r cos θ,  z = r sin θ,  y = i × rise'],
      ['Sunflower spiral', 'θ = i × 137.5° (golden angle);  r = R × √(i ÷ (n − 1))'],
      ['Grid', 'column = i mod columns,  row = ⌊i ÷ columns⌋;  x = column × gap,  z = row × gap (centred)'],
      ['Circle', 'θ = i × 360° ÷ n;  x = R cos θ,  z = R sin θ'],
      ['Wave', 'y = A × sin(k × distance from the centre)  on a grid of points'],
      ['Radial rings', 'ring k has (first ring) × k objects at radius r = k × gap;  θ = 360° × j ÷ (objects in ring)'],
      ['Sphere (Fibonacci)', 'h = 1 − 2(i + 0.5) ÷ n;  ring = √(1 − h²) (Pythagoras);  θ = i × 137.5°'],
      ['Random scatter', 'positions from a seeded random generator, so the same seed gives the same result'],
    ],
    [0.24, 0.76],
  ),
  P(
    'The extract below is the generate function of the spiral pattern. For each object it works out the angle θ and the distance r, and then uses x = r cos θ and z = r sin θ, exactly the formulas a student learns in trigonometry.',
  ),
  CODE(
    'Extract from web/src/engine/patterns/spiral.ts',
    `generate(p, n) {
  const out: BasePlacement[] = [];
  for (let i = 0; i < n; i++) {
    const { r, thetaDeg, y } = spiralPoint(p, i, n);
    const th = thetaDeg * DEG;               // degrees → radians
    out.push({ position: [r * Math.cos(th), y, r * Math.sin(th)],
               align: yaw(-th) });           // face along the spiral
  }
  return out;
}`,
  ),
  P(
    'Figure 3.8 shows the example from the project brief, “100 spheres → spiral → radius 20 → rotation 30 → scale 0.5–2”, typed into the recipe box. Figure 3.9 shows the Pattern panel, where every value can be changed with a slider or by typing a number.',
  ),
  FIG('3.8', 'The 3D studio showing the brief’s example: 100 spheres in a spiral', 'studio', 0.9),
  FIG('3.9', 'The Pattern panel with plain-language controls', 'pattern-tab', 0.9),
  P(
    'To keep the view smooth with thousands of objects, all copies of the same shape are drawn with **instanced rendering**: the graphics card receives one shape and a list of positions, instead of thousands of separate objects. A scene of 20,000 objects still turns smoothly on an ordinary laptop.',
  ),
  H3('3.4.3', 'Learn and Measure Panels'),
  P(
    'The **Learn** panel (Figure 3.10) explains the idea behind the selected pattern in one or two sentences, lists its formulas, and works them out for any object the user chooses. For example, it shows θ = 10 × 30° = 300° and x = 2.02 × cos 300° = 1.01 for object number 10. The aim is that students see the same formulas from their textbook producing the artwork in front of them.',
  ),
  FIG('3.10', 'The Learn panel with the spiral formulas and a worked example', 'learn', 0.9),
  P(
    'The **Measure** panel (Figure 3.11) gives the volume and surface area of one object with full working (for a sphere, V = 4/3 × π × r³). It then explains how scaling by k changes the area by k² and the volume by k³, so it can add up the whole pattern. For the exact volume of overlapping objects, the panel calls the geometry service, which joins all the shapes into one solid first.',
  ),
  FIG('3.11', 'The Measure panel with step-by-step working', 'measure', 0.9),
  H3('3.4.4', 'Recipes, Ideas and the Assistant'),
  P(
    'The **recipe box** at the top of the studio accepts one-line descriptions such as “300 cones → sphere → radius 10” or “12 stars in a circle, radius 8”. A small parser written for this project splits the text into tokens, recognises numbers, shapes, patterns and settings (including synonyms such as “rotation” for the turn between objects), and reports a clear message if something is not understood.',
  ),
  P(
    'The **ideas gallery** (Figure 3.12) opens ready-made scenes such as the wave field in Figure 3.13, which students can study and change. On the home page, the chat box sends the user’s request to an optional AI helper through the geometry service; when the AI is not available, a built-in local matcher still turns common requests into recipes.',
  ),
  P('Table 3.12 shows examples of what a student can type and the mathematics each one demonstrates.'),
  TABLE(
    '3.12',
    'Example recipes and the mathematics they show',
    ['What the student types', 'What MathMe makes', 'Mathematics shown'],
    [
      ['100 spheres → spiral → radius 20 → rotation 30 → scale 0.5–2', 'A growing spiral of spheres of different sizes', 'Angles, x = r cos θ, linear growth of r'],
      ['500 spheres in a sunflower', 'Seeds packed like a sunflower head', 'Golden angle 137.5°, r ∝ √i'],
      ['200 rainbow cubes in a wave', 'A field of cubes rising and falling', 'y = A sin(distance), periodic functions'],
      ['12 stars in a circle, radius 8', 'Twelve stars evenly around a circle', '360° ÷ 12 = 30° steps'],
      ['300 cones on a sphere, rainbow', 'A spiky ball of evenly spread cones', 'Fibonacci sphere, Pythagoras'],
      ['50 red spheres in a circle', 'A ring of fifty spheres', 'Circle equation, equal angles'],
    ],
    [0.38, 0.32, 0.3],
  ),
  FIG('3.12', 'The ideas gallery', 'ideas', 0.9),
  FIG('3.13', 'The “Wave field” idea: 625 cubes rising and falling as y = A sin(distance)', 'wave-field', 0.9),
  H3('3.4.5', 'Custom Shapes'),
  P(
    'Besides the 21 built-in shape types (cuboid, sphere, cylinder, cone, torus, prism, pyramid, the five Platonic solids, torus knot, capsule and more), MathMe lets the user make their own shapes. A **spun shape** (Figure 3.14) is drawn as half an outline and spun around an axis, like clay on a potter’s wheel, to make vases, bowls and goblets. An **extruded shape** pushes a flat outline up into a solid. There are also 3D text, graph surfaces of the form y = f(x, z) and parametric surfaces. Groups of shapes can be saved under “Mine” and used as the source of a pattern.',
  ),
  FIG('3.14', 'A spun (lathe) shape and its editable side outline', 'custom-shape', 0.9),
  H3('3.4.6', 'Exports'),
  P(
    'All exports are made inside the browser, so they work without a server (Figure 3.15). Table 3.7 lists the formats. Each exporter converts the instanced scene into ordinary meshes, applies the right units (metres for GLB, millimetres for STL) and names every part so that it can be found again in other programs.',
  ),
  TABLE(
    '3.7',
    'Export formats',
    ['Format', 'Used for', 'Notes'],
    [
      ['GLB (glTF 2.0)', 'Blender, Unity, Unreal, web pages', 'One mesh per object, in metres'],
      ['STL', '3D printers (slicer software)', 'In millimetres; print-ready joined solid via the geometry service'],
      ['OBJ', 'Almost every 3D program', 'Simple text format'],
      ['PNG', 'Posters and slides', 'HD, 4K or square; optional see-through background'],
      ['PDF', 'Class reports', 'Project sheet with views, settings and the maths'],
      ['SVG, DXF, PDF', '2D sketches', 'Vector drawings for CAD and laser cutting'],
      ['.mathme.json', 'Saving and sharing projects', 'Opens again in MathMe with File → Open'],
    ],
    [0.2, 0.36, 0.44],
  ),
  FIG('3.15', 'The export dialog', 'export', 0.9),
  H3('3.4.7', 'Geometry Service (Python)'),
  P(
    'Some tasks need exact geometry that is too heavy or too complex for the browser. These run in the **geometry service**, a FastAPI application with the following endpoints:',
  ),
  UL([
    '**/analyze:** volume, surface area and bounds of the whole model.',
    '**/boolean:** join, cut or overlap two shapes.',
    '**/export:** print-ready files.',
    '**/slice:** cut the heart model.',
    '**/assist:** the AI helper.',
  ]),
  P(
    'The browser sends the scene as a GLB file, and the service loads it with the trimesh library and uses the manifold3d engine for robust boolean operations. Inputs are limited in size, triangle count and running time, so that one request cannot overload the server.',
  ),
  CODE(
    'Extract from geometry-service/app/geometry.py',
    `def boolean(a, b, operation, settings):
    first = union_all(solid_parts(a, "The first shape"), settings)
    second = union_all(solid_parts(b, "The second shape"), settings)
    op = {"union": trimesh.boolean.union,
          "difference": trimesh.boolean.difference,
          "intersection": trimesh.boolean.intersection}[operation]
    result = op([first, second], engine="manifold")
    if result is None or len(result.faces) == 0:
        raise GeometryError("Nothing is left after cutting.")
    return result`,
  ),
  H3('3.4.8', 'Human Heart Slice Atlas'),
  P(
    'To show how the same tools serve science teaching, MathMe includes a real, scan-based human heart from the **Human Reference Atlas** of the HuBMAP consortium (licensed CC BY 4.0), with 51 named structures. The cut tool (Figure 3.16) slices the model along 21 standard planes used in anatomy and cardiac imaging, such as the four-chamber, three-chamber, two-chamber and short-axis views, or along any angle chosen with the sliders. The plane is shown as an equation n · x = d, again linking the anatomy to the mathematics of planes. The Python side also produces a labelled PDF slice atlas of about 50 pages.',
  ),
  FIG('3.16', 'The heart model cut along the four-chamber view', 'heart', 0.9),
  H3('3.4.9', 'Pencil Drawing'),
  P(
    'The pencil (Figure 3.17) lets beginners draw directly in the 3D view. A closed loop drawn on the floor becomes a solid that can be pushed up; an open line becomes a 3D pen “tube”; and a “lines” mode lets the user click corner points to make straight-edged shapes. The drawn points are simplified and smoothed before the solid is built, so freehand drawings still give clean shapes.',
  ),
  FIG('3.17', 'Drawing a solid and a 3D pen tube with the pencil', 'pencil', 0.9),
  H3('3.4.10', '2D Sketch Board'),
  P(
    'The 2D sketch board (Figure 3.18) is a geometry board in the style of a school notebook. The user places **node points**, joins them with **lines**, and draws **circles by radius**. Points snap to the grid, to other points and to the middle of lines. Selecting a closed shape shows its area and perimeter; selecting a line shows its length and angle; selecting two lines shows the angle between them.',
  ),
  P(
    'The user can add geometric **rules**: horizontal, vertical, fixed length, parallel, perpendicular, equal and fixed radius. A small **constraint solver**, written for this project, nudges the points again and again, like a network of springs, until every rule holds, and it reports any rules that conflict. Sketches can be exported as SVG, PNG, PDF and DXF, or turned into 3D solids by pushing them up (extrusion) or spinning them (lathe).',
  ),
  FIG('3.18', 'The 2D sketch board: a 3-4-5 triangle (area 6 cm²) and a circle of radius 2', 'sketch', 0.9),
  H3('3.4.11', 'User Interface and Settings'),
  P(
    'The interface was redesigned during the internship to be minimal and friendly:',
  ),
  UL([
    'a collapsible sidebar in the style of modern chat applications;',
    'a details panel that can be hidden;',
    'consistent brand colours taken from the MathMe presentation;',
    'a welcome tour and a help window with a glossary of maths words.',
  ]),
  P(
    'The Settings page (Figure 3.19) groups the project options (name, author, units and background), appearance (light or dark theme), 3D-view options, data management and an About section.',
  ),
  FIG('3.19', 'The Settings page', 'settings', 0.9),
  P(
    'The Help window (Figure 3.20) explains every tool in short sentences, lists the keyboard shortcuts and includes a glossary of “maths words” (such as radius, angle, sine, volume and symmetry) in simple language, so that students can look up a term without leaving the studio.',
  ),
  FIG('3.20', 'The Help window with the glossary of maths words', 'help', 0.9),
  H3('3.4.12', 'Accounts, Plans and Limits'),
  P(
    'Accounts are switched on by a build setting (VITE_ACCOUNTS), so the free demo and self-hosted copies keep working without a server. When accounts are on, users sign in with **Google** using the secure authorisation-code flow: the browser never sees Google’s tokens. The server creates a session stored in an HttpOnly cookie, and only a hash of the session token is kept in the database.',
  ),
  P(
    'Each plan’s limits come from the shared plans file. Before an export, a geometry job or an AI message, the app asks the server for a “ticket”, and the server counts the use with an atomic database update. When a limit is reached, or a feature belongs to a higher plan, the user sees a friendly prompt that names the feature and the plan that unlocks it (Figure 3.21). The plans window (Figure 3.22) compares Free, Plus and Pro with monthly and yearly prices.',
  ),
  FIG('3.21', 'Upgrade prompt shown when a Free user chooses the STL export', 'upgrade-prompt', 0.9),
  FIG('3.22', 'The plans window', 'pricing', 0.9),
  H3('3.4.13', 'Checkout, GST and Invoices'),
  P(
    'Checkout asks for the details needed for a GST invoice: name, mobile number, state and an optional GSTIN for businesses (Figure 3.23). The buyer’s state decides the tax lines: within the seller’s state, 9% CGST and 9% SGST; otherwise, 18% IGST. All amounts are handled in **paise** (whole numbers), so there are no rounding errors from decimal fractions. Table 3.8 shows the prices with GST.',
  ),
  TABLE(
    '3.8',
    'Prices with 18% GST',
    ['Plan', 'Price before GST', 'GST (18%)', 'Total charged'],
    [
      ['Plus, monthly', '₹299.00', '₹53.82', '₹352.82'],
      ['Plus, yearly', '₹2,499.00', '₹449.82', '₹2,948.82'],
      ['Pro, monthly', '₹799.00', '₹143.82', '₹942.82'],
      ['Pro, yearly', '₹6,999.00', '₹1,259.82', '₹8,258.82'],
      ['Campus, yearly', '₹14,999.00', '₹2,699.82', '₹17,698.82'],
    ],
    [0.28, 0.24, 0.22, 0.26],
  ),
  CODE(
    'Extract from account-service/src/account_service/gst.py',
    `def add_gst(base: int, seller_state: str, buyer_state: str) -> Tax:
    """Base price (paise, before GST) → the tax lines and the total."""
    tax = (base * RATE_PERCENT + 50) // 100   # 18%, rounded half up to the paisa
    if seller_state.strip().lower() == buyer_state.strip().lower():
        cgst = tax // 2
        return Tax(base, cgst, tax - cgst, 0, base + tax)   # CGST + SGST
    return Tax(base, 0, 0, tax, base + tax)                  # IGST`,
  ),
  FIG('3.23', 'Checkout with the GST split (Karnataka: CGST + SGST)', 'checkout', 0.9),
  P(
    'Payments use **Cashfree Payments**. Monthly plans are set up as a subscription mandate (UPI AutoPay, card or e-mandate), and yearly plans as a one-time order. Cashfree informs MathMe of every payment through a **webhook**. The flow is shown in Figure 3.25:',
  ),
  UL([
    'The server first checks the webhook’s signature, a Base64 HMAC-SHA256 of the timestamp and the body, keyed with a secret.',
    'It rejects messages that are more than five minutes old.',
    'It records each event id, so that a repeated message is processed only once.',
    'It then records the payment and issues an invoice numbered per financial year (for example MM/2026-27/000001).',
    'It emails a receipt. The invoice can be downloaded as a PDF from Settings → Account (Figure 3.24).',
  ]),
  CODE(
    'Extract from account-service/src/account_service/cashfree.py',
    `def sign(secret: str, timestamp: str, raw_body: bytes) -> str:
    """Cashfree's webhook signature: Base64(HMAC-SHA256(secret, timestamp + body))."""
    mac = hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256)
    return base64.b64encode(mac.digest()).decode()`,
  ),
  FIG('3.24', 'Settings → Account: plan, usage meters and the GST invoice', 'account-settings', 0.9),
  FIG('3.25', 'Sequence diagram of a Plus checkout', 'sequence', 0.9),
  H3('3.4.14', 'Campus Licences and the Class Page'),
  P(
    'A school or college starts with an enquiry form on the landing page. The owner turns the enquiry into a **Campus licence** for 100 students and 5 teachers, which creates two join codes, one for teachers and one for students. When a member signs in and types a code, the server checks the seat limits and adds them to the class. Teachers then get Pro features and students get Plus features while the licence is valid.',
  ),
  P(
    'Students can share a cloud project with their class. The teacher’s class page (Figure 3.26) shows the licence, the codes, the shared projects (which the teacher can open as a copy) and the class list, from which a student can be removed.',
  ),
  FIG('3.26', 'The teacher’s class page with shared projects and the class list', 'class-page', 0.9),
  H3('3.4.15', 'Owner Dashboard'),
  P(
    'The owner dashboard (Figure 3.27) is visible only to the accounts listed as owners. It shows:',
  ),
  UL([
    'sign-ups and weekly active users;',
    'paying users by plan and the free-to-paid conversion rate;',
    'monthly recurring revenue (MRR) and 30-day churn;',
    'revenue before GST;',
    'Campus pilots and paid licences.',
  ]),
  P(
    'Separate tabs list enquiries, Campus licences (Figure 3.28), with actions to extend a licence, mark it paid or send a payment link, and recent payments. A **revenue calculator** (Figure 3.29) reproduces the scenario from the business plan, ₹86,125 a month or ₹10,33,495 a year, and lets the owner try other numbers of Plus, Pro, Campus and Enterprise customers.',
  ),
  FIG('3.27', 'The owner dashboard', 'admin', 0.9),
  FIG('3.28', 'Campus licences in the owner dashboard', 'admin-campus', 0.9),
  FIG('3.29', 'The revenue scenario calculator', 'admin-calculator', 0.9),

  H3('3.4.16', 'Landing Page, Enquiries and Policy Pages'),
  P(
    'The public landing page (Figures 2.1 and 2.2) was designed in the colours of the MathMe presentation deck. It explains the idea in four steps (add a shape, let maths copy it, see the formulas, export and share), shows a gallery of patterns, the heart atlas and the export formats, and ends with the pricing section. The prices on this page are checked by an automated test against the shared plans file, so they can never fall out of step with the prices charged at checkout.',
  ),
  P(
    'Schools and companies use the enquiry form on the landing page to ask for a Campus pilot or an Enterprise quotation. The form sends the request to the account service, which stores it for the owner dashboard and emails the owner. A hidden field catches automated spam, and the form never emails the address typed into it, so it cannot be misused to send mail to strangers.',
  ),
  P(
    'A payment gateway in India requires a business to publish its Terms of Use, Privacy Policy, Refund and Cancellation Policy and Contact details before it can accept payments. Draft versions of all four pages were written during the internship in plain language. They describe the plans, GST, automatic renewal and cancellation, refunds, commercial-use rights on the Pro plan, the personal data collected and the rights of users under India’s Digital Personal Data Protection Act, 2023. The drafts are clearly marked to be reviewed by a lawyer before launch.',
  ),
  H2('3.5', 'Testing'),
  H3('3.5.1', 'Testing Strategy'),
  P('Testing was done at four levels, and all of them run automatically in the continuous-integration pipeline:'),
  UL([
    '**Unit tests (Vitest)** check the maths engine: shapes, patterns, formulas, the recipe parser, the sketch solver, project files, plan limits and the revenue calculator.',
    '**Browser tests (Playwright)** open the real application in Chromium and act like a user: make a project, apply a pattern, draw with the pencil, sketch a triangle, export every file type, cut the heart, and so on.',
    '**Accounts browser tests** run the account service with a pretend payment provider and a test sign-in, and go through sign-in, limits, checkout with GST, cloud saves, the Campus flow, the dashboard and invoices.',
    '**Service tests (pytest)** check the geometry service (volumes, booleans, exports, the heart slicer) and the account service (sign-in, sessions, projects, quotas, GST, webhook signatures, subscriptions, Campus licences, admin access).',
  ]),
  H3('3.5.2', 'Test Cases'),
  TABLE(
    '3.9',
    'Selected test cases',
    ['ID', 'Test scenario', 'Expected result', 'Result'],
    [
      ['TC1', 'Type “100 spheres → spiral → radius 20”', '100 objects appear in a spiral', 'Pass'],
      ['TC2', 'Add a cuboid and apply the grid pattern', 'Object count becomes 200', 'Pass'],
      ['TC3', 'Select object 10 of the spiral, open Learn', 'Worked example shows θ = 300°', 'Pass'],
      ['TC4', 'Sketch a 3-4-5 triangle and select it', 'Area 6 cm², perimeter 12 cm', 'Pass'],
      ['TC5', 'Draw a circle with radius 2', 'Area 12.57 cm²', 'Pass'],
      ['TC6', 'Export GLB', 'Valid glTF 2.0 file, one mesh per object', 'Pass'],
      ['TC7', 'Join two overlapping cuboids (service)', 'One watertight solid, correct volume', 'Pass'],
      ['TC8', 'Cut the heart along the four-chamber view', 'Plane normal n = (0.054, 0.881, 0.47)', 'Pass'],
      ['TC9', 'Free user chooses STL export', 'Upgrade prompt names Plus', 'Pass'],
      ['TC10', 'Save a 4th cloud project on Free', 'Project stays on the device only', 'Pass'],
      ['TC11', 'Checkout Plus from Kerala (seller in Karnataka)', 'IGST 18%, total ₹352.82', 'Pass'],
      ['TC12', 'Webhook with a wrong signature or old timestamp', 'Rejected (401)', 'Pass'],
      ['TC13', 'Same payment webhook delivered twice', 'Payment recorded once', 'Pass'],
      ['TC14', 'Teacher and student join with codes', 'Teacher gets Pro, student gets Plus', 'Pass'],
      ['TC15', 'Non-owner opens the admin API', 'Refused (403)', 'Pass'],
      ['TC16', 'Sign-in link replayed in another browser', 'Sign-in refused (login CSRF guard)', 'Pass'],
    ],
    [0.08, 0.38, 0.4, 0.14],
  ),
  H3('3.5.3', 'Test Results'),
  TABLE(
    '3.10',
    'Summary of automated test results',
    ['Test suite', 'Tool', 'Tests', 'Passed'],
    [
      ['Web application: unit tests', 'Vitest', '147', '147'],
      ['Web application: browser tests', 'Playwright', '29', '29'],
      ['Accounts: browser tests', 'Playwright', '6', '6'],
      ['Account service', 'pytest', '51', '51'],
      ['Geometry service', 'pytest', '40', '40'],
      ['**Total**', '', '**273**', '**273**'],
    ],
    [0.42, 0.2, 0.19, 0.19],
  ),
  P(
    'In addition, the code passes ESLint, Prettier and the strict TypeScript compiler for the web application, and ruff (lint and format) for both Python services. The layouts were checked by hand on a desktop screen and at phone width.',
  ),
  H2('3.6', 'Deployment Plan'),
  P(
    'The application was built so that it can be hosted cheaply and scaled easily. The web application and the account service are deployed together on Cloudflare: the Worker serves the website files and answers every request under /api. The geometry service runs as a Docker container on any container host. A step-by-step deployment guide (docs/DEPLOY.md) was written as part of the internship; Table 3.11 summarises it.',
  ),
  TABLE(
    '3.11',
    'Deployment steps',
    ['Step', 'Activity', 'Result'],
    [
      ['1', 'Create the D1 database and the R2 storage bucket; apply the SQL migrations', 'Tables ready in the cloud'],
      ['2', 'Store the secrets (Google, Cashfree, Resend, geometry secret) with the Wrangler tool', 'No secret is kept in the code'],
      ['3', 'Create a Google OAuth client with the sign-in callback address', 'Users can sign in with Google'],
      ['4', 'Activate Cashfree, test in the sandbox, register the webhook address', 'Payments and webhooks work'],
      ['5', 'Verify the email domain in Resend', 'Receipts and reminders are delivered'],
      ['6', 'Run the geometry container with the shared secret', 'Measure, join and cut work for signed-in users'],
      ['7', 'Build the web app with accounts on and deploy the Worker', 'MathMe is live on its own domain'],
      ['8', 'Check a preview deployment end to end before real customers', 'A safe launch'],
    ],
    [0.08, 0.6, 0.32],
  ),
  P(
    'Without accounts, the same web application can be published as a plain static website (for example on GitHub Pages or a school server), with every feature free and projects kept in the browser. This makes MathMe easy to try in any classroom.',
  ),
  H2('3.7', 'Security Measures'),
  P('Because the product handles accounts and payments, security was reviewed before the work was completed. The main measures are:'),
  UL([
    'Session cookies are **HttpOnly, Secure and SameSite=Lax**; only a SHA-256 hash of each session token is stored.',
    'Every request that changes data must carry a custom header that other websites cannot send, which protects against cross-site request forgery.',
    'The Google sign-in round trip is tied to the browser that started it with a short-lived state cookie, and the return address after sign-in is checked so that it cannot send users to another website.',
    'Payment webhooks are accepted only with a valid HMAC signature, within a five-minute window, and only once per event.',
    'Test sign-in and the pretend payment page work only on a developer’s own computer (localhost), so a forgotten setting cannot give anyone free plans or owner access.',
    'The geometry service can require a shared secret, so only the account service, which checks quotas first, can use it.',
    'All input is validated (Pydantic on the server, Zod for project files), and uploads are limited in size and processing time.',
  ]),
  H2('3.8', 'Learning During the Internship'),
  P('The internship provided hands-on experience in many areas of computer applications:'),
  UL([
    '**Mathematics in software:** trigonometry, the golden angle, Fibonacci spheres, vectors, plane equations, area and volume formulas, and scaling laws (k² and k³) turned into working code.',
    '**3D graphics:** meshes, materials, cameras, instanced rendering, coordinate systems and units, and file formats such as glTF, STL and OBJ.',
    '**Front-end development:** React components and hooks, state management with undo and redo, TypeScript types, responsive layouts and accessibility.',
    '**Back-end development:** REST APIs with FastAPI, input validation, SQL database design, migrations and serverless deployment on Cloudflare Workers.',
    '**Payments and compliance:** subscription mandates, webhooks, idempotency, GST calculation (CGST, SGST, IGST), invoice numbering per financial year, and the policy pages required by a payment gateway.',
    '**Security:** sessions and cookies, OAuth 2.0, CSRF protection, HMAC signatures and the principle of least privilege.',
    '**Software engineering:** planning in milestones, version control with Git, code reviews, automated testing at several levels, continuous integration and technical documentation.',
    '**Professional skills:** breaking a large goal into small steps, managing time across ten weeks, explaining technical work in simple language, and writing this report.',
  ]),
  BREAK,
];
