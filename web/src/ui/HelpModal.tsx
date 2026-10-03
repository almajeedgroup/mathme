import { Accordion, Kbd, List, Modal, Table, Tabs, Text } from '@mantine/core';

import { useUiStore } from '../state/uiStore';

const GLOSSARY: [string, string][] = [
  ['Radius', 'The distance from the center of a circle or sphere to its edge. Half of the diameter.'],
  ['Angle (°)', 'How far something is turned. A full turn is 360°, a right angle is 90°.'],
  [
    'Golden angle',
    '137.5°, which is 360° × (1 − 1/φ) where φ ≈ 1.618 is the golden ratio. Sunflowers and pine cones use it to pack seeds.',
  ],
  [
    'sin and cos',
    'For an angle θ, (cos θ, sin θ) is a point on a circle of radius 1. Multiply by r to get a bigger circle: x = r cos θ, z = r sin θ.',
  ],
  ['Sine wave', 'y = A × sin(x): it goes up to A, down to −A and repeats. A is the amplitude (wave height).'],
  ['Wavelength', 'The distance from one wave top to the next.'],
  ['Spiral', 'A curve that winds around a center while moving away from it (or up, for a helix).'],
  ['Helix', 'A spiral that keeps the same width and climbs, like a spring or a spiral staircase.'],
  ['Volume', 'How much space a solid takes up, in cubic units (cm³). A 1 cm cube has a volume of 1 cm³.'],
  ['Surface area', 'The total area of the outside of a shape, in square units (cm²).'],
  [
    'Scale factor',
    'If a shape is k times bigger, its area is k² times bigger and its volume is k³ times bigger.',
  ],
  [
    'Symmetry',
    'A shape has mirror symmetry if one half is a reflection of the other, and rotational symmetry if it looks the same after a turn.',
  ],
  ['Frustum', 'A cone with its top cut off flat. V = ⅓πh(R² + Rr + r²).'],
  ['Prism', 'A solid with the same polygon at both ends joined by flat sides. V = base area × height.'],
  [
    'Platonic solid',
    'A solid whose faces are all the same regular polygon: tetrahedron, cube, octahedron, dodecahedron and icosahedron.',
  ],
  ['Parametric surface', 'A surface where x, y and z are each given by a formula of two numbers u and v.'],
  [
    'Random seed',
    'The starting number for the random-number formula. The same seed always gives the same "random" result.',
  ],
  [
    'Mesh / triangles',
    'Computers draw curved shapes as many small flat triangles. More triangles = smoother.',
  ],
];

const KEYS: [string[], string][] = [
  [['Ctrl', 'Z'], 'Undo'],
  [['Ctrl', 'Y'], 'Redo'],
  [['Ctrl', 'D'], 'Duplicate'],
  [['Ctrl', 'G'], 'Group selected things'],
  [['Delete'], 'Delete selected things'],
  [['W'], 'Move tool'],
  [['E'], 'Turn tool'],
  [['R'], 'Stretch tool'],
  [['F'], 'Fit everything in view'],
  [['Esc'], 'Select nothing'],
  [['Shift', 'click'], 'Select more than one thing'],
];

export function HelpModal() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setOpen);
  return (
    <Modal opened={open} onClose={() => setOpen('helpOpen', false)} title="Help" size="lg" centered>
      <Tabs defaultValue="howto">
        <Tabs.List mb="sm">
          <Tabs.Tab value="howto">How to</Tabs.Tab>
          <Tabs.Tab value="words">Maths words</Tabs.Tab>
          <Tabs.Tab value="keys">Keys</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="howto">
          <Accordion defaultValue="start" variant="separated">
            <Accordion.Item value="start">
              <Accordion.Control>Make your first artwork</Accordion.Control>
              <Accordion.Panel>
                <List type="ordered" size="sm" spacing={4}>
                  <List.Item>Add a shape from the left (try a Cuboid).</List.Item>
                  <List.Item>Change its width, height and depth on the right.</List.Item>
                  <List.Item>
                    With the shape selected, click a pattern (try Spiral). Your shape is copied many times.
                  </List.Item>
                  <List.Item>
                    Change “How many?” and the pattern numbers. Open the Learn tab to see the maths.
                  </List.Item>
                  <List.Item>Click Export to save a 3D model, a picture or a PDF sheet.</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="recipe">
              <Accordion.Control>Type a recipe</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm">
                  Describe what you want in the box at the top and press Enter, for example{' '}
                  <Text span ff="monospace" size="sm">
                    100 objects → spiral → radius 20 → rotation 30° → size 0.5–2
                  </Text>
                  . You can use →, &gt; or commas between the parts. Words that work: a number and a shape
                  (100 cubes), a pattern (spiral, helix, sunflower, grid, circle, wave, ripples, rings,
                  sphere, dome, scatter), radius, rotation, spacing, height, columns, rows, wave height,
                  wavelength, size a–b, spin, wobble, shake, colour red to blue, rainbow, random colours,
                  mirror x, kaleidoscope 6, seed.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="own">
              <Accordion.Control>Make your own shapes</Accordion.Control>
              <Accordion.Panel>
                <List size="sm" spacing={4}>
                  <List.Item>Make → Spun shape: draw half an outline and spin it (vases, bowls).</List.Item>
                  <List.Item>
                    Make → Extruded shape: draw a flat outline and give it thickness (stars, hearts).
                  </List.Item>
                  <List.Item>Make → Graph surface: type y = f(x, z), e.g. sin(x) * cos(z).</List.Item>
                  <List.Item>
                    Select several things → Group them → Save as my shape. It appears under Mine.
                  </List.Item>
                  <List.Item>
                    Select two things to Join, Cut or Overlap them (needs the geometry service).
                  </List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="cut">
              <Accordion.Control>Cut through a model (and the real heart)</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm">
                  Ideas → “Human heart (real anatomy)” opens a scan-based heart with 51 named parts. Press the
                  scissors in the 3D view to cut: choose a standard view (four-chamber, short axis…) or drag
                  Tilt, Turn and Slide. “Keep side A/B” chooses which half stays, and “Look at the cut face”
                  turns the camera to face the cut. With the geometry service running, “Export this cut” saves
                  both halves (GLB and STL) with closed cut faces. You can also cut your own models: File →
                  Import 3D model.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="print">
              <Accordion.Control>3D printing</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm">
                  Export → STL gives a file for 3D printer software, in millimetres. For one clean solid, use
                  “Print-ready” (it joins overlapping parts). Flat sheets and graph surfaces have no
                  thickness, so they can’t be printed on their own.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Tabs.Panel>
        <Tabs.Panel value="words">
          <Table fz="sm" striped verticalSpacing={4}>
            <Table.Tbody>
              {GLOSSARY.map(([word, meaning]) => (
                <Table.Tr key={word}>
                  <Table.Td fw={600} style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {word}
                  </Table.Td>
                  <Table.Td>{meaning}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
        <Tabs.Panel value="keys">
          <Table fz="sm" verticalSpacing={4}>
            <Table.Tbody>
              {KEYS.map(([keys, what]) => (
                <Table.Tr key={what}>
                  <Table.Td>
                    {keys.map((k, i) => (
                      <span key={k}>
                        {i > 0 && ' + '}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </Table.Td>
                  <Table.Td>{what}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
