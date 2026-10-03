import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

async function download(page: Page, testId: string) {
  const promise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByTestId(testId).click();
  const d = await promise;
  return { name: d.suggestedFilename(), data: readFileSync(await d.path()) };
}

function readGlb(buf: Buffer) {
  expect(buf.toString('ascii', 0, 4)).toBe('glTF');
  expect(buf.readUInt32LE(4)).toBe(2);
  expect(buf.readUInt32LE(8)).toBe(buf.length);
  const jsonLength = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // "JSON"
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLength));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#studio');
  await expect(page.getByTestId('object-count')).toHaveText('100 objects');
  await page.getByTestId('open-export').click();
});

test('GLB: one mesh per object, saved in metres', async ({ page }) => {
  const { name, data } = await download(page, 'export-glb');
  expect(name).toBe('my-3d-artwork.glb');
  const gltf = readGlb(data);
  const meshNodes = gltf.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined);
  expect(meshNodes).toHaveLength(100);
  expect(meshNodes[0].name).toBe('Spiral of spheres #1');
  // all 100 spheres share the same triangle data; each has its own gradient colour
  const positions = new Set(
    gltf.meshes.map(
      (m: { primitives: { attributes: { POSITION: number } }[] }) => m.primitives[0].attributes.POSITION,
    ),
  );
  expect(positions.size).toBe(1);
  expect(gltf.materials).toHaveLength(100);
  // centimetres → metres
  const root = gltf.nodes[gltf.scenes[0].nodes[0]];
  expect(root.name).toBe('My 3D artwork');
  expect(root.matrix[0]).toBeCloseTo(0.01);
});

test('STL: binary file whose size matches its triangle count', async ({ page }) => {
  const { name, data } = await download(page, 'export-stl');
  expect(name).toBe('my-3d-artwork.stl');
  const triangles = data.readUInt32LE(80);
  expect(triangles).toBeGreaterThan(50_000);
  expect(data.length).toBe(84 + 50 * triangles);
});

test('PNG picture in HD', async ({ page }) => {
  const { data } = await download(page, 'export-png');
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(data.readUInt32BE(16)).toBe(1920);
  expect(data.readUInt32BE(20)).toBe(1080);
});

test('PDF project sheet has at least 3 pages', async ({ page }) => {
  const { data } = await download(page, 'export-pdf');
  const text = data.toString('latin1');
  expect(text.startsWith('%PDF')).toBe(true);
  expect((text.match(/\/Type \/Page[^s]/g) ?? []).length).toBeGreaterThanOrEqual(3);
});

test('OBJ has one named object per sphere', async ({ page }) => {
  const { data } = await download(page, 'export-obj');
  const text = data.toString('utf8');
  expect((text.match(/^o /gm) ?? []).length).toBe(100);
});
