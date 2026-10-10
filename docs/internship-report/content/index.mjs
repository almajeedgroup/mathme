// The whole report, in order.
import { front } from './front.mjs';
import { chapter1, chapter2, summary } from './ch1-2.mjs';
import { chapter3 } from './ch3.mjs';
import { bibliography, chapter4 } from './ch4.mjs';

export { PROJECT, STUDENT, SUBTITLE } from './front.mjs';
export const frontMatter = front;
export const body = [...summary, ...chapter1, ...chapter2, ...chapter3, ...chapter4, ...bibliography];
