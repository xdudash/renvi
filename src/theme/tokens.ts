// Colour and type tokens taken verbatim from the approved RENVI iOS prototype
// (design/source/8adf9793-renvi-ios-mockups.html, :root and "approved brand edition").
export const colors = {
  paper: '#F7F5F2',
  white: '#FDFCF9',
  ink: '#201E1D',
  sub: '#706862',
  line: '#E3DED8',
  red: '#DA302B',
  redDark: '#B62420',
  redWash: '#F9E9E5',
  blush: '#F0D6D0',
  green: '#27785d',
  greenWash: '#e4f1e9',
  amber: '#9d6f1f',
  amberWash: '#f7eedb',
  eyebrow: '#817873',
  muted: '#8f8c84',
  tabInactive: '#8f8c85',
  chipBorder: '#F0CFC8',
  safeBanner: '#EFEEE8',
  safeBannerBorder: '#E5E2D8',
  safeBannerText: '#625D53',
  surfaceMuted: '#EAE6E0',
  scrim: 'rgba(32,30,29,0.44)',
} as const;

export const radius = {
  pill: 99,
  button: 25,
  card: 17,
  input: 13,
  tile: 17,
  device: 47,
} as const;

export const spacing = {
  gutter: 18,
} as const;
