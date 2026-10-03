import { LATHE_PRESETS, PARAMETRIC_PRESETS } from '../shapes/profiles';
import type { ObjectNode, PatternNode, Project, ShapeType } from '../types';
import {
  createGroupNode,
  createObjectNode,
  createPatternNode,
  defaultMaterial,
  emptyProject,
  shapeSource,
  specExampleNode,
} from './defaults';

/** Ready-made scenes ("Ideas") that show off what the maths can do. */
export interface PresetDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  build(): Project;
}

function shapeWith(type: ShapeType, params: Record<string, unknown>) {
  const src = shapeSource(type);
  if (src.kind === 'shape') Object.assign(src.shape.params, params);
  return src;
}

function project(name: string, nodes: Project['nodes'], background = '#f6f3ff'): Project {
  return { ...emptyProject(name), nodes, background };
}

function pattern(
  name: string,
  type: PatternNode['pattern']['type'],
  source: PatternNode['source'],
  patch: (n: PatternNode) => void,
): PatternNode {
  const n = createPatternNode(source, type, name);
  patch(n);
  return n;
}

function object(
  name: string,
  source: ObjectNode['source'],
  patch: (n: ObjectNode) => void = () => {},
): ObjectNode {
  const n = createObjectNode(source, name);
  patch(n);
  return n;
}

export const PRESETS: PresetDef[] = [
  {
    id: 'spec',
    title: 'Spiral of spheres',
    icon: '🌀',
    description:
      'The example from the project brief: 100 objects → spiral → radius 20 → rotation 30° → size 0.5–2.',
    build: () => project('Spiral of spheres', [specExampleNode()]),
  },
  {
    id: 'sunflower',
    title: 'Sunflower',
    icon: '🌻',
    description: 'Seeds placed with the golden angle (137.5°). Nature uses this to pack seeds without gaps.',
    build: () =>
      project('Sunflower', [
        pattern('Sunflower seeds', 'spiral', shapeSource('sphere'), (n) => {
          n.count = 600;
          n.pattern.params = { ...n.pattern.params, style: 'sunflower', radius: 14, rise: 0 };
          n.variation = {
            ...n.variation,
            sizeFrom: 0.25,
            sizeTo: 0.55,
            colorFrom: '#5c3d1e',
            colorTo: '#fab005',
          };
        }),
        pattern('Petals', 'circle', shapeWith('capsule', { radius: 1.2, length: 3 }), (n) => {
          n.count = 24;
          n.pattern.params = { ...n.pattern.params, radius: 17 };
          n.variation = { ...n.variation, objectRotation: [0, 0, 90], colorMode: 'single' };
          n.material = defaultMaterial('#ffd43b');
        }),
      ]),
  },
  {
    id: 'staircase',
    title: 'Spiral staircase',
    icon: '🪜',
    description: 'A helix of steps around a pole. Each step turns 20° and climbs 0.45.',
    build: () =>
      project('Spiral staircase', [
        pattern('Steps', 'spiral', shapeWith('box', { width: 4, height: 0.3, depth: 1.4 }), (n) => {
          n.count = 36;
          n.pattern.params = { ...n.pattern.params, style: 'helix', radius: 2.2, angleStep: 20, rise: 0.45 };
          n.variation = { ...n.variation, colorFrom: '#a0522d', colorTo: '#e9b872' };
        }),
        object('Pole', shapeWith('cylinder', { radiusTop: 0.35, radiusBottom: 0.35, height: 17 }), (n) => {
          n.transform.position = [0, 8.2, 0];
          n.material = defaultMaterial('#868e96');
          n.material.metalness = 0.8;
          n.material.roughness = 0.3;
        }),
        pattern('Hand rail', 'spiral', shapeSource('sphere'), (n) => {
          n.count = 140;
          n.transform.position = [0, 2.2, 0];
          n.pattern.params = { ...n.pattern.params, style: 'helix', radius: 4.1, angleStep: 5, rise: 0.1125 };
          n.variation = { ...n.variation, sizeFrom: 0.22, sizeTo: 0.22, colorMode: 'single' };
          n.material = defaultMaterial('#495057');
        }),
      ]),
  },
  {
    id: 'dna',
    title: 'DNA double helix',
    icon: '🧬',
    description: 'Two helices half a turn (180°) apart, joined by rungs, like the molecule in your cells.',
    build: () => {
      const strand = (name: string, start: number, color: string) =>
        pattern(name, 'spiral', shapeSource('sphere'), (n) => {
          n.count = 40;
          n.pattern.params = {
            ...n.pattern.params,
            style: 'helix',
            radius: 3,
            angleStep: 18,
            rise: 0.5,
            startAngle: start,
          };
          n.variation = { ...n.variation, sizeFrom: 0.6, sizeTo: 0.6, colorMode: 'single' };
          n.material = defaultMaterial(color);
        });
      return project('DNA double helix', [
        strand('Strand A', 0, '#1c7ed6'),
        strand('Strand B', 180, '#e03131'),
        pattern(
          'Rungs',
          'spiral',
          shapeWith('cylinder', { radiusTop: 0.12, radiusBottom: 0.12, height: 6 }),
          (n) => {
            n.count = 40;
            n.pattern.params = { ...n.pattern.params, style: 'helix', radius: 0, angleStep: 18, rise: 0.5 };
            n.variation = {
              ...n.variation,
              objectRotation: [0, 0, 90],
              colorFrom: '#40c057',
              colorTo: '#fab005',
            };
          },
        ),
      ]);
    },
  },
  {
    id: 'atom',
    title: 'Atom',
    icon: '⚛️',
    description: 'A nucleus of protons and neutrons with electrons on tilted orbits.',
    build: () => {
      const nodes: Project['nodes'] = [
        pattern('Nucleus', 'random', shapeWith('sphere', { radius: 0.7 }), (n) => {
          n.count = 24;
          n.pattern.params = { ...n.pattern.params, area: 'ball', radius: 1.4 };
          n.variation = { ...n.variation, colorMode: 'random' };
          n.seed = 4;
        }),
      ];
      [0, 60, 120].forEach((turn, k) => {
        const g = createGroupNode(`Orbit ${k + 1}`);
        // tip the flat ring up by 70°, then turn each orbit a third of the way round
        g.transform.rotation = [0, turn, 70];
        const ring = object('Orbit path', shapeWith('torus', { ringRadius: 8, tube: 0.05 }), (n) => {
          n.parentId = g.id;
          n.material = defaultMaterial('#adb5bd');
        });
        const electron = object('Electron', shapeWith('sphere', { radius: 0.5 }), (n) => {
          n.parentId = g.id;
          const a = (k * 120 * Math.PI) / 180;
          n.transform.position = [8 * Math.cos(a), 0, 8 * Math.sin(a)];
          n.material = defaultMaterial('#fab005');
        });
        nodes.push(g, ring, electron);
      });
      return project('Atom', nodes, '#1a1b1e');
    },
  },
  {
    id: 'wave-field',
    title: 'Wave field',
    icon: '🌊',
    description: '625 cubes whose heights follow y = A × sin(distance). Like a stone dropped in a pond.',
    build: () =>
      project('Wave field', [
        pattern('Ripples', 'wave', shapeWith('box', { width: 1, height: 1, depth: 1 }), (n) => {
          n.count = 625;
          n.pattern.params = {
            ...n.pattern.params,
            style: 'ripple',
            columns: 25,
            spacing: 1.2,
            amplitude: 2,
            wavelength: 9,
          };
          n.variation = { ...n.variation, colorMode: 'rainbow', sizeFrom: 0.9, sizeTo: 0.9 };
        }),
      ]),
  },
  {
    id: 'snowflake',
    title: 'Snowflake',
    icon: '❄️',
    description: 'Six-fold symmetry: build one arm, and the kaleidoscope copies it 6 times, 60° apart.',
    build: () => {
      const ice = () => {
        const m = defaultMaterial('#a5d8ff');
        m.metalness = 0.3;
        m.roughness = 0.2;
        return m;
      };
      return project(
        'Snowflake',
        [
          object('Center', shapeWith('prism', { sides: 6, side: 1.2, height: 0.4 }), (n) => {
            n.material = ice();
          }),
          object('Arm', shapeWith('box', { width: 7, height: 0.3, depth: 0.45 }), (n) => {
            n.transform.position = [4, 0, 0];
            n.symmetry.radialCopies = 6;
            n.material = ice();
          }),
          object('Inner twig', shapeWith('box', { width: 2.2, height: 0.25, depth: 0.35 }), (n) => {
            n.transform.position = [3.6, 0, 0.75];
            n.transform.rotation = [0, -45, 0];
            n.symmetry = { mirrorX: false, mirrorY: false, mirrorZ: true, radialCopies: 6 };
            n.material = ice();
          }),
          object('Outer twig', shapeWith('box', { width: 1.5, height: 0.25, depth: 0.3 }), (n) => {
            n.transform.position = [5.9, 0, 0.5];
            n.transform.rotation = [0, -45, 0];
            n.symmetry = { mirrorX: false, mirrorY: false, mirrorZ: true, radialCopies: 6 };
            n.material = ice();
          }),
          object('Tips', shapeWith('octahedron', { radius: 0.45 }), (n) => {
            n.transform.position = [7.6, 0, 0];
            n.symmetry.radialCopies = 6;
            n.material = ice();
          }),
        ],
        '#e7f5ff',
      );
    },
  },
  {
    id: 'spiky-ball',
    title: 'Spiky ball',
    icon: '🦔',
    description: '150 cones spread evenly over a sphere (Fibonacci sphere), each one pointing outwards.',
    build: () =>
      project('Spiky ball', [
        object('Core', shapeWith('sphere', { radius: 5.5, smoothness: 48 }), (n) => {
          n.material = defaultMaterial('#7048e8');
        }),
        pattern('Spikes', 'sphere', shapeWith('cone', { radius: 0.45, height: 2.5 }), (n) => {
          n.count = 150;
          n.pattern.params = { ...n.pattern.params, radius: 6.2 };
          n.variation = { ...n.variation, colorFrom: '#fab005', colorTo: '#e64980' };
        }),
      ]),
  },
  {
    id: 'pottery',
    title: 'Pottery shop',
    icon: '🏺',
    description: 'Spun shapes (lathe): a vase in the middle and a circle of goblets around it.',
    build: () =>
      project('Pottery shop', [
        object('Vase', shapeWith('lathe', { profile: LATHE_PRESETS[0].points, smoothness: 64 }), (n) => {
          n.transform.position = [0, 2.1, 0];
          n.transform.scale = [1.5, 1.5, 1.5];
          n.material = defaultMaterial('#c2410c');
        }),
        pattern(
          'Goblets',
          'circle',
          shapeWith('lathe', { profile: LATHE_PRESETS[2].points, smoothness: 48 }),
          (n) => {
            n.count = 8;
            n.transform.position = [0, 1.8, 0];
            n.pattern.params = { ...n.pattern.params, radius: 7 };
            n.variation = { ...n.variation, colorMode: 'rainbow' };
          },
        ),
      ]),
  },
  {
    id: 'mobius',
    title: 'Möbius strip',
    icon: '♾️',
    description: 'A strip with only one side! Made from a parametric formula with u and v.',
    build: () =>
      project('Möbius strip', [
        object(
          'Möbius strip',
          shapeWith('parametric', { ...PARAMETRIC_PRESETS[0].params, scale: 2.5, resolution: 120 }),
          (n) => {
            n.transform.position = [0, 2.5, 0];
            n.material = defaultMaterial('#12b886');
          },
        ),
      ]),
  },
  {
    id: 'landscape',
    title: 'Maths landscape',
    icon: '🏔️',
    description: 'The graph of y = sin(x) × cos(z) as a 3D surface, with its formula written above it.',
    build: () =>
      project('Maths landscape', [
        object(
          'y = sin(x) cos(z)',
          shapeWith('graphSurface', {
            formula: 'sin(x) * cos(z)',
            size: 20,
            heightScale: 1.5,
            resolution: 100,
          }),
          (n) => {
            n.material = defaultMaterial('#40c057');
          },
        ),
        object('Formula', shapeWith('text3d', { text: 'y = sin(x) cos(z)', size: 1.4, depth: 0.3 }), (n) => {
          n.transform.position = [0, 5, -6];
          n.material = defaultMaterial('#1c7ed6');
        }),
      ]),
  },
];
