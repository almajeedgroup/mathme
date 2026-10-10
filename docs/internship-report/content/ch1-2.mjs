// Executive summary, Chapter I (Introduction) and Chapter II (Description of the Organisation / Project).
import { BLANK, BREAK, CHAPTER, FIG, H2, H3, P, SHORT, TABLE, TITLE, UL } from './blocks.mjs';

export const summary = [
  { t: 'page', kind: 'body' },
  TITLE('EXECUTIVE SUMMARY'),
  P(
    'This report presents the internship project **“MathMe 3D Studio: Generative 3D Art & Object Studio”**, carried out as an independent internship project during the Third Semester of the Bachelor of Computer Applications (BCA) programme. The internship comprised **90 hours** of part-time work spread over **10 weeks**.',
  ),
  P(
    'Traditional 3D modelling software asks the user to create, move, rotate and resize every object by hand. Placing two hundred spheres in a spiral can take hours, and beginners must learn a large number of tools before they make anything. At the same time, school students often see mathematics (angles, sine and cosine, sequences, areas and volumes) as abstract formulas with no visible use. MathMe was built to connect these two problems: **the student writes one mathematical rule, and the computer places every object.**',
  ),
  P(
    'MathMe is a web application that runs in any modern browser. The user picks a shape by its width, height and radius, chooses one of seven patterns (spiral, grid, circle, wave, radial rings, sphere and random scatter) and sees hundreds or thousands of copies appear instantly in a 3D view. A “Learn” panel shows the formula behind every pattern with the user’s own numbers filled in, and a “Measure” panel works out volume and surface area step by step. Finished work can be exported as GLB, STL, OBJ, PNG or PDF files for 3D printing, games, posters and class reports.',
  ),
  P(
    'During the internship the application grew into a complete product with the following parts:',
  ),
  UL([
    'a **maths engine** written in TypeScript (shapes, patterns, formulas, a plain-language recipe parser and a 2D constraint solver);',
    'a **3D studio** built with React, Three.js (react-three-fiber) and the Mantine component library, including a pencil tool, a 2D sketch board and an ideas gallery;',
    'a **geometry service** written in Python with FastAPI, trimesh and manifold3d for exact measurements, joining and cutting solids, print-ready files and a real human-heart slice atlas;',
    'an **account service** in Python for Cloudflare Workers that adds Google sign-in, cloud saves, subscription plans in Indian rupees with 18% GST, Cashfree payments, school (Campus) licences and an owner dashboard.',
  ]),
  P(
    'The work followed an iterative method: small milestones, each one designed, built, tested and committed before the next. The finished system is covered by **147 unit tests and 35 browser tests** for the web application and **91 automated tests** for the two Python services, all of which pass, and a continuous-integration pipeline runs them on every change.',
  ),
  P(
    'The internship provided practical experience of the full software development life cycle: requirement analysis, system design (architecture, data-flow and entity-relationship diagrams), front-end and back-end programming, database design, payment integration, security, automated testing and technical documentation. This report describes the project setting (Chapter II), the work done and the knowledge gained week by week (Chapter III), and the outcomes, limitations and future scope of the work (Chapter IV).',
  ),
  BREAK,
];

export const chapter1 = [
  { t: 'page', kind: 'body' },
  CHAPTER('CHAPTER I', 'INTRODUCTION'),
  H2('1.1', 'Background of the Internship Project'),
  P(
    'Computer graphics and 3D printing are becoming part of school and college laboratories, and students are increasingly asked to design models, posters and simulations. Most 3D tools, however, are built for professional artists. They expose hundreds of buttons, and they treat every object as a separate item to be placed by hand.',
  ),
  P(
    'Mathematics offers a better way to describe many designs. A sunflower, a spiral staircase, a DNA double helix, a snowflake or a field of waves can each be described by a short rule: how many objects, which pattern, how far apart, and how much each one turns or grows. If a computer program understands such rules, a student can create a complex artwork in seconds and, at the same time, see exactly how angles, trigonometry and sequences produce the shapes in front of them.',
  ),
  P(
    'The project brief, titled “Generative 3D Art & Object Studio”, asked for exactly this kind of tool. Its example rule, **“100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2”**, became the guiding test case of the internship. MathMe 3D Studio is the result: a browser-based studio, written with 10th-grade students in mind, where mathematics is the main design tool.',
  ),
  H2('1.2', 'Problem Statement'),
  P('The internship set out to address the following problems:'),
  UL([
    '**Repetitive manual modelling.** Creating patterned 3D artwork in traditional software means creating, moving, rotating and resizing each object separately, which is slow and error-prone.',
    '**Steep learning curve.** Beginners must learn a large set of tools and technical vocabulary (vertices, modifiers, transforms) before they can make anything.',
    '**Mathematics without context.** Students learn formulas such as x = r cos θ or the volume of a sphere, but rarely see them used to build something real.',
    '**Hard-to-share results.** Many tools produce files that only the same tool can open, which makes printing, presenting and sharing difficult in a classroom.',
    '**Sustainability.** A free educational tool also needs a fair, legal way to cover its hosting costs in India (plans, GST invoices and school licences).',
  ]),
  P(
    'The aim was therefore to build a tool in which one mathematical rule creates every object, every formula is visible and explained, and the result can be exported to standard file formats, while keeping the interface simple enough for a school student.',
  ),
  H2('1.3', 'Existing System and Proposed System'),
  P(
    'Before designing MathMe, the tools that students and teachers already use were studied. Each is good at its own job, but none of them combines pattern-based 3D modelling, visible mathematics and classroom-friendly exports in one simple tool.',
  ),
  UL([
    '**Professional 3D software** (for example Blender) is very powerful and can make repeated patterns with array modifiers or node systems, but it is designed for trained artists. A beginner must learn many concepts before making a simple pattern, and the mathematics stays hidden inside the tool.',
    '**Beginner 3D design tools** (for example Tinkercad) are easy to start with and export files for 3D printing, but objects are still placed one at a time, and the tools do not explain the mathematics behind a design.',
    '**Mathematics software** (for example GeoGebra 3D) shows graphs, surfaces and formulas very well, but it is not built for making artwork from hundreds of objects or for producing posters and project sheets.',
  ]),
  TABLE(
    '1.1',
    'Existing systems compared with the proposed system',
    ['Feature', 'Professional 3D tools', 'Beginner 3D tools', 'Maths software', 'MathMe (proposed)'],
    [
      ['Easy for a 10th-grade student', 'No', 'Yes', 'Partly', 'Yes'],
      ['One rule places many objects', 'Yes, with advanced tools', 'No', 'Partly', 'Yes, 7 patterns'],
      ['Shows the formula for every object', 'No', 'No', 'Yes', 'Yes, with worked examples'],
      ['Volume and area with working', 'No', 'No', 'Partly', 'Yes'],
      ['Plain-language recipe', 'No', 'No', 'No', 'Yes'],
      ['3D-print and game exports', 'Yes', 'Yes', 'Partly', 'Yes'],
      ['Runs in a browser, no installation', 'No', 'Yes', 'Yes', 'Yes'],
      ['Class page for teachers', 'No', 'Yes', 'Yes', 'Yes'],
    ],
    [0.28, 0.18, 0.18, 0.16, 0.2],
  ),
  P(
    'The **proposed system**, MathMe, keeps the ease of beginner tools and the clear formulas of mathematics software, and adds the pattern power of professional tools: the user writes one rule, sees every object placed by it, reads the formula behind it, and exports real files.',
  ),
  H2('1.4', 'Objectives of the Project'),
  P('The main objectives of the internship project were:'),
  UL([
    'To design and develop a web-based 3D studio in which shapes are described by simple measurements (width, height, depth, radius).',
    'To implement a generation engine with seven mathematical patterns that place hundreds or thousands of copies of a shape automatically.',
    'To show the formula behind every pattern and shape, worked out with the user’s own numbers, so that the tool also teaches mathematics.',
    'To support a plain-language “recipe” such as “100 spheres → spiral → radius 20”, so that a model can be described in one line.',
    'To export the result as GLB, STL, OBJ, PNG and PDF files for games, 3D printing, posters and reports.',
    'To build a Python geometry service for exact measurements, joining and cutting of solids, and an educational human-heart slice atlas.',
    'To add a 2D sketch board with points, lines, circles, measurements and geometric rules, and to turn sketches into 3D solids.',
    'To add user accounts, cloud saves, subscription plans with GST-compliant invoices, school licences and an owner dashboard, so that the product can be offered sustainably.',
    'To test every part automatically and document the system for future maintenance and deployment.',
  ]),
  H2('1.5', 'Scope of the Project'),
  P('**In scope.** The project covers:'),
  UL([
    'the complete web application (home page, 3D studio, 2D sketch board, exports, settings and help);',
    'the geometry service and the account service;',
    'the landing page with pricing, and draft policy pages;',
    'automated tests and the deployment guide.',
  ]),
  P(
    'The application works fully without an account: projects are saved in the browser, and every feature can be used. Signing in adds cloud saves, paid plans and school features.',
  ),
  P('**Out of scope.** The following were deliberately left for later phases:'),
  UL([
    'native mobile applications;',
    'real-time collaborative editing;',
    'class assignments and grading;',
    'a marketplace for shared designs;',
    'a public developer API.',
  ]),
  P(
    'The heart atlas is for education only: it shows one reference heart and is not a medical record.',
  ),
  H2('1.6', 'Methodology'),
  P(
    'The internship followed an **iterative and incremental** development method, similar to the agile practice of short sprints. The work was divided into milestones; each milestone was planned, implemented, tested and committed to the version-control repository before the next one began. This kept the application working at every stage and made it easy to show progress to the guide.',
  ),
  P('Every milestone followed the same cycle:'),
  UL([
    '**Plan:** write down what the milestone must achieve and how it will be tested.',
    '**Design:** sketch the data model, the user interface and the interfaces between parts.',
    '**Implement:** write the code in small, readable steps.',
    '**Test:** write unit tests for the logic and browser tests for the user flows; run lint, formatting and type checks.',
    '**Review and commit:** read the change again, fix problems, and commit it with a clear message.',
  ]),
  P(
    'The milestones were: project set-up; the maths engine and 3D view; custom shapes; recipes and project files; exports; the geometry service; the heart atlas; interface design and the home page; the pencil and the 2D sketch board; and finally accounts, plans, payments, school licences and the owner dashboard. Table 3.1 in Chapter III maps them to the ten weeks of the internship.',
  ),
  H2('1.7', 'Internship Details'),
  TABLE(
    '1.2',
    'Internship details',
    ['Particular', 'Details'],
    [
      ['Name of the student', 'Sulaimaan'],
      ['Register number', BLANK],
      ['Programme and semester', 'Bachelor of Computer Applications (BCA), Semester III'],
      ['Title of the internship project', 'MathMe 3D Studio: Generative 3D Art & Object Studio'],
      ['Type of internship', 'Independent internship project (software development)'],
      ['Mode', 'Part-time, during the semester'],
      ['Duration', '90 hours over 10 weeks'],
      ['Period', `From ${SHORT} to ${SHORT}`],
      ['Internal guide', BLANK],
      ['Domain', 'Educational technology, 3D graphics, web development'],
    ],
    [0.38, 0.62],
  ),
  H2('1.8', 'Tools and Technologies Used'),
  P(
    'The project uses free and open-source tools throughout. Table 1.3 lists the main technologies and the purpose of each one.',
  ),
  TABLE(
    '1.3',
    'Tools and technologies used',
    ['Area', 'Technology', 'Purpose in MathMe'],
    [
      ['Front-end language', 'TypeScript 5', 'Type-safe code for the whole web application'],
      ['User interface', 'React 19, Mantine 9', 'Components, panels, dialogs and forms'],
      ['3D graphics', 'Three.js, react-three-fiber, drei', '3D view, instanced rendering, cameras and gizmos'],
      ['State', 'zustand, immer, zundo', 'Application state with undo and redo'],
      ['Build tool', 'Vite 8', 'Fast development server and production build'],
      ['Back-end language', 'Python 3.11+', 'Geometry service and account service'],
      ['Web framework', 'FastAPI, Pydantic', 'REST APIs with validated input'],
      ['Geometry', 'trimesh, manifold3d', 'Exact volumes, joining and cutting solids'],
      ['Hosting (planned)', 'Cloudflare Workers, D1, R2', 'Serverless API, SQLite database, file storage'],
      ['Payments', 'Cashfree Payments', 'UPI AutoPay subscriptions, orders, payment links'],
      ['Email', 'Resend', 'Receipts and renewal reminders'],
      ['Sign-in', 'Google OAuth 2.0', 'Secure sign-in without passwords'],
      ['Documents', 'jsPDF', 'PDF project sheets and GST invoices in the browser'],
      ['Testing', 'Vitest, Playwright, pytest', 'Unit tests, browser tests, service tests'],
      ['Quality', 'ESLint, Prettier, ruff', 'Linting and consistent formatting'],
      ['Version control', 'Git, GitHub Actions', 'History, branches and continuous integration'],
      ['Editor', 'Visual Studio Code', 'Writing and debugging code'],
    ],
    [0.22, 0.32, 0.46],
  ),
  H2('1.9', 'Organisation of the Report'),
  P('The rest of this report is organised as follows:'),
  UL([
    '**Chapter II** describes the project setting: MathMe’s vision and mission, its users, its products, its business model and the way the work was organised.',
    '**Chapter III** describes the experiential learning: the weekly work log, the requirements, the system design with diagrams, the implementation of every module with screenshots, the testing, and what was learnt.',
    '**Chapter IV** summarises the outcomes, skills gained, challenges and solutions, limitations and future enhancements, and concludes the report.',
    'The **Bibliography** lists the books and documentation referred to during the internship.',
  ]),
  BREAK,
];

export const chapter2 = [
  { t: 'page', kind: 'body' },
  CHAPTER('CHAPTER II', 'DESCRIPTION OF THE ORGANISATION / PROJECT'),
  P(
    'This internship was carried out as an **independent internship project** and not inside an outside company. In place of a company profile, this chapter describes the project itself as the organisation in which the work was done: its vision and mission, its users, the products it offers, its business model, and the way the work was planned and managed.',
  ),
  H2('2.1', 'About MathMe'),
  P(
    '**MathMe 3D Studio** is a generative 3D art and object studio for students, teachers and makers. Its name combines “Math” and “Me”: mathematics made personal, visible and creative. The product runs entirely in a web browser, so it needs no installation and works on school computers, laptops and tablets.',
  ),
  P(
    'The central idea of MathMe is that **one rule creates every object**. Instead of placing two hundred spheres by hand, the user writes a rule (how many, which pattern, which sizes) and the studio calculates every position, rotation and scale. Changing one number updates the whole artwork. Every rule explains itself in a Learn panel, so the same tool is both a creative studio and a mathematics lesson.',
  ),
  FIG('2.1', 'The MathMe landing page', 'landing', 0.92),
  H2('2.2', 'Vision and Mission'),
  P(
    '**Vision.** To make mathematics the most creative subject in school by letting every student build real 3D art and objects from simple rules.',
  ),
  P('**Mission.**'),
  UL([
    'To give students a free, friendly studio in which every formula is visible and every shape is described in plain words.',
    'To let teachers use the same tool for lessons on geometry, trigonometry, sequences, area and volume, and for science topics such as human anatomy.',
    'To produce real files (3D prints, models for games, posters and reports) so that students can take their work beyond the screen.',
    'To keep the product sustainable through fair, transparent pricing in Indian rupees and affordable school licences.',
  ]),
  H2('2.3', 'Target Users'),
  UL([
    '**School students (Classes 8–12):** learn geometry and trigonometry by building artwork; the interface was written with 10th-grade students in mind.',
    '**College students:** use MathMe for design, engineering-drawing and computer-graphics coursework, and for 3D printing.',
    '**Teachers:** demonstrate formulas live, set creative tasks and see their students’ shared work on a class page.',
    '**Makers and designers:** create patterned objects, print-ready models and posters quickly.',
    '**Schools and colleges:** buy a Campus licence for a whole class with teacher and student accounts.',
  ]),
  H2('2.4', 'Products and Services'),
  P(
    'MathMe is organised as a set of modules that work together. Table 2.1 summarises each module and what it offers to the user.',
  ),
  TABLE(
    '2.1',
    'MathMe modules and services',
    ['Module', 'What it offers'],
    [
      ['Home page', 'Project list with pictures, an AI-assisted chat box (“describe what to make”), an ideas gallery'],
      ['3D studio', '21 shape types, 7 patterns, variation, symmetry, colours, undo/redo, a plain-language recipe box'],
      ['Learn and Measure', 'The formula behind every pattern with a worked example; volume and surface area with full working'],
      ['Pencil', 'Draw closed outlines that become solids, or 3D pen lines that become tubes, directly in the 3D view'],
      ['2D sketch board', 'Points, lines and circles by radius, snapping, measurements, geometric rules, 2D-to-3D'],
      ['Exports', 'GLB, STL, OBJ, PNG (HD, 4K, square, see-through), PDF project sheet, SVG, DXF, project file'],
      ['Geometry service', 'Exact volume of the whole model, join / cut / overlap of solids, print-ready joined STL'],
      ['Heart atlas', 'A real human heart (Human Reference Atlas) with 51 structures, cut along 21 standard planes or any angle'],
      ['Accounts and cloud', 'Google sign-in, cloud saves, plans and limits, GST invoices'],
      ['Campus', 'School licences, join codes, class page with shared student projects'],
      ['Owner dashboard', 'Sign-ups, active users, paying users, MRR, churn, enquiries, licences, revenue calculator'],
    ],
    [0.26, 0.74],
  ),
  H2('2.5', 'Business Model and Plans'),
  P(
    'MathMe follows a **“freemium”** business model. Everything can be tried for free, and paid plans add more capacity, more export formats and commercial-use rights. All prices and limits are stored in one file (shared/plans.json), which is read by the web application, the server and the tests, so that the prices shown can never disagree with the prices charged. Prices are in Indian rupees and **18% GST is added at checkout**: CGST and SGST (9% each) within the seller’s state, or IGST (18%) for other states.',
  ),
  TABLE(
    '2.2',
    'MathMe plans (prices before 18% GST)',
    ['Plan', 'Price', 'Main features'],
    [
      ['Free (Explorer)', '₹0', '3 patterns, 2,000 objects per scene, 3 cloud projects, 15 exports a month (PNG HD, project file), 5 AI messages and 5 geometry jobs a day'],
      ['Plus (Creator)', '₹299 a month or ₹2,499 a year', 'All 7 patterns, 20,000 objects, 2D-to-3D, GLB/STL/OBJ/SVG/DXF/PDF, 200 exports a month, 50 cloud projects, 50 AI messages and 50 geometry jobs a day'],
      ['Pro (Professional)', '₹799 a month or ₹6,999 a year', '4K and see-through PNG, print-ready STL, 1,000 exports a month, 500 cloud projects, 300 geometry jobs a day processed first, commercial use, priority support'],
      ['Campus', '₹14,999 a year', '100 student accounts (Plus) and 5 teacher accounts (Pro), class page and join codes; starts with a free pilot'],
      ['Enterprise', 'By quotation', 'Volume licences and custom workflows for universities, laboratories and studios'],
    ],
    [0.2, 0.24, 0.56],
  ),
  P(
    'For example, the Plus plan costs ₹299 + ₹53.82 GST = **₹352.82** a month, and the Campus licence costs ₹14,999 + ₹2,699.82 GST = **₹17,698.82** a year. Monthly plans renew through a UPI AutoPay or card mandate; yearly plans are a single payment with reminder emails before they end.',
  ),
  FIG('2.2', 'The pricing section of the landing page', 'landing-pricing', 0.92),
  H2('2.6', 'Project Team and Roles'),
  P(
    'Because this was an independent internship project, the student carried out every role in the project, under the supervision of the internal guide. Table 2.3 lists the roles.',
  ),
  TABLE(
    '2.3',
    'Roles in the internship project',
    ['Role', 'Person', 'Responsibilities'],
    [
      ['Developer and designer', 'Sulaimaan', 'Requirements, design, front-end and back-end programming, user interface, diagrams'],
      ['Tester', 'Sulaimaan', 'Unit tests, browser tests, service tests, manual checks on desktop and phone sizes'],
      ['Documentation', 'Sulaimaan', 'Plan, README, deployment guide, policy drafts and this report'],
      ['Internal guide', BLANK, 'Reviews, suggestions and evaluation of the internship'],
    ],
    [0.26, 0.2, 0.54],
  ),
  H2('2.7', 'Working Environment and Practices'),
  P(
    'The internship used a professional software engineering environment, so that the project could be maintained and extended after the internship:',
  ),
  UL([
    '**Version control:** all code lives in a Git repository on GitHub. Work is done on a feature branch, and every milestone is a separate commit with a descriptive message.',
    '**Monorepo structure:** the web application (web/), the geometry service (geometry-service/), the account service (account-service/), shared data (shared/) and documentation (docs/) are kept in one repository.',
    '**Continuous integration:** a GitHub Actions pipeline runs linting, formatting checks, type checking, unit tests, the production build, browser tests and the Python tests on every push.',
    '**Code quality:** ESLint and Prettier for TypeScript, ruff for Python; strict TypeScript settings; small, readable functions with comments where the reason is not obvious.',
    '**Documentation:** a project plan (docs/PLAN.md), a README with setup and checks, and a step-by-step deployment guide (docs/DEPLOY.md).',
    '**Working hours:** about nine hours a week on a part-time basis, with a short written log of the work done each week (Table 3.1).',
  ]),
  BREAK,
];
