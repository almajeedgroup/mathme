import type { ParamField } from '../engine/fields';
import { fmt } from '../engine/math';
import { getPattern } from '../engine/patterns/registry';
import { getShape } from '../engine/shapes/registry';
import type { Params, Project, SceneNode, Units, VariationDef } from '../engine/types';

/** Plain-English descriptions of how each part of the project was made (for the PDF sheet). */

function unitText(field: ParamField, units: Units): string {
  if (field.kind !== 'number') return '';
  if (field.unit === 'length') return ` ${units}`;
  if (field.unit === 'angle') return '°';
  if (field.unit === 'factor') return '×';
  return '';
}

export function describeParams(
  fields: ParamField[],
  params: Params,
  defaults: Params,
  units: Units,
): string[] {
  const merged = { ...defaults, ...params };
  const out: string[] = [];
  for (const f of fields) {
    if (f.visibleIf && !f.visibleIf(merged)) continue;
    const v = merged[f.key];
    if (v === undefined) continue;
    if (f.kind === 'points') out.push(`${f.label}: ${Array.isArray(v) ? v.length : 0} points`);
    else if (f.kind === 'select')
      out.push(`${f.label}: ${f.options.find((o) => o.value === v)?.label ?? String(v)}`);
    else if (f.kind === 'boolean') out.push(`${f.label}: ${v ? 'yes' : 'no'}`);
    else if (f.kind === 'number' && typeof v === 'number')
      out.push(`${f.label}: ${fmt(v, 3)}${unitText(f, units)}`);
    else out.push(`${f.label}: ${String(v)}`);
  }
  return out;
}

function describeVariation(v: VariationDef): string[] {
  const out: string[] = [];
  if (v.sizeFrom === v.sizeTo && v.sizeFrom !== 1) {
    out.push(`every object is ${fmt(v.sizeFrom)}× its normal size`);
  } else if (v.sizeFrom !== v.sizeTo) {
    const how =
      v.sizeMode === 'random'
        ? 'random sizes between'
        : v.sizeMode === 'pulse'
          ? 'pulsing between'
          : 'sizes grow from';
    out.push(`${how} ${fmt(v.sizeFrom)}× and ${fmt(v.sizeTo)}×`);
  }
  if (v.followPattern) out.push('objects line up with the pattern');
  if (v.spinStep) out.push(`each object spins ${fmt(v.spinStep)}° more than the last`);
  if (v.objectRotation.some((a) => a !== 0))
    out.push(`every object tipped by (${v.objectRotation.map((a) => fmt(a)).join('°, ')}°)`);
  if (v.wobble) out.push(`random wobble up to ${fmt(v.wobble)}°`);
  if (v.jitter) out.push(`random shake up to ${fmt(v.jitter)}`);
  if (v.colorMode === 'gradient') out.push(`colours fade from ${v.colorFrom} to ${v.colorTo}`);
  if (v.colorMode === 'rainbow') out.push('rainbow colours');
  if (v.colorMode === 'random') out.push('random colours');
  return out;
}

export interface NodeDescription {
  title: string;
  lines: string[];
}

export function describeNode(node: SceneNode, project: Project): NodeDescription {
  const lines: string[] = [];
  const units = project.units;
  if (node.kind !== 'group') {
    if (node.source.kind === 'shape') {
      const def = getShape(node.source.shape.type);
      lines.push(
        `Shape: ${def.label}. ${describeParams(def.fields, node.source.shape.params, def.defaults, units).join('; ')}`,
      );
    } else {
      const id = node.source.customId;
      const custom = project.library.find((c) => c.id === id);
      lines.push(`Shape: my shape "${custom?.name ?? '?'}" (${custom?.parts.length ?? 0} parts)`);
    }
  }
  if (node.kind === 'pattern') {
    const def = getPattern(node.pattern.type);
    lines.push(
      `Pattern: ${def.label}, ${node.count} objects. ${describeParams(def.fields, node.pattern.params, def.defaults, units).join('; ')}`,
    );
    const v = describeVariation(node.variation);
    if (v.length) lines.push(`Variation: ${v.join('; ')}`);
  }
  if (node.kind === 'group') {
    const n = project.nodes.filter((c) => c.parentId === node.id).length;
    lines.push(`Group of ${n} things`);
  }
  const s = node.symmetry;
  const sym: string[] = [];
  if (s.mirrorX) sym.push('mirrored across X');
  if (s.mirrorY) sym.push('mirrored across Y');
  if (s.mirrorZ) sym.push('mirrored across Z');
  if (s.radialCopies > 1) sym.push(`${s.radialCopies} copies spun ${fmt(360 / s.radialCopies)}° apart`);
  if (sym.length) lines.push(`Symmetry: ${sym.join('; ')}`);
  const t = node.transform;
  lines.push(
    `Placed at (${t.position.map((v) => fmt(v)).join(', ')}) ${units}` +
      (t.rotation.some((a) => a) ? `, turned (${t.rotation.map((v) => fmt(v)).join('°, ')}°)` : '') +
      (t.scale.some((v) => v !== 1) ? `, stretched (${t.scale.map((v) => fmt(v)).join(' × ')})` : ''),
  );
  return { title: node.name, lines };
}
