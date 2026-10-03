import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Colours from the MathMe presentation deck (web/landing/theme.json).
export const BRAND = {
  violet: '#915bff',
  lime: '#f8fd6e',
  pink: '#ff2d94',
  blue: '#3841c9',
  blush: '#feb4d6',
  plum: '#3e001b',
  ink: '#1b1230',
  canvas: '#f6f3ff',
} as const;

const violet: MantineColorsTuple = [
  '#f4efff',
  '#e6dcff',
  '#cbb6ff',
  '#b08eff',
  '#9c6dff',
  '#915bff',
  '#8048f0',
  '#6c38d6',
  '#5a2db3',
  '#45218a',
];

const lime: MantineColorsTuple = [
  '#fdfee8',
  '#fbfdc9',
  '#f9fd9c',
  '#f8fd6e',
  '#eef34f',
  '#dbe03a',
  '#bcc12a',
  '#969a1e',
  '#717414',
  '#4c4e0a',
];

const pink: MantineColorsTuple = [
  '#ffe8f3',
  '#ffcfe6',
  '#feb4d6',
  '#ff85bd',
  '#ff57a6',
  '#ff2d94',
  '#e61f83',
  '#c41570',
  '#9f0f5b',
  '#7a0945',
];

// Dark mode greys, tinted toward the deck's plum.
const dark: MantineColorsTuple = [
  '#cdc6df',
  '#b3a9cb',
  '#8f86a8',
  '#6b6285',
  '#4a4262',
  '#352e4a',
  '#2a2440',
  '#1f1a30',
  '#181425',
  '#110e1b',
];

export const theme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 5, dark: 4 },
  colors: { violet, lime, pink, dark },
  defaultRadius: 'xl',
  fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Urbanist, "DM Sans", system-ui, sans-serif', fontWeight: '800' },
  black: BRAND.ink,
  cursorType: 'pointer',
  components: {
    ActionIcon: { defaultProps: { variant: 'subtle', color: 'gray' } },
    Tooltip: { defaultProps: { openDelay: 300, color: 'dark' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Tabs: { defaultProps: { radius: 'xl' } },
  },
});
