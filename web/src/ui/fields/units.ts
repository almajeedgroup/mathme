import type { FieldUnit } from '../../engine/fields';
import type { Units } from '../../engine/types';

export function unitSuffix(unit: FieldUnit, units: Units): string {
  switch (unit) {
    case 'length':
      return units;
    case 'angle':
      return '°';
    case 'factor':
      return '×';
    default:
      return '';
  }
}
