import { StyleSheet, useWindowDimensions } from 'react-native';

export const colors = {
  brand: '#ea580c',
  brandDark: '#c2410c',
  brandSoft: '#fff7ed',
  ink: '#1c1917',
  bg: '#f5f5f4',
  card: '#ffffff',
  border: '#e7e5e4',
  text: '#1c1917',
  muted: '#78716c',
  danger: '#e11d48',
  dangerSoft: '#fff1f2',
  success: '#10b981',
  warning: '#d97706',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: '#44403c', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  error: { color: colors.danger, fontSize: 14 },
});

/** Tablet-aware layout values. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600;
  return {
    width,
    isTablet,
    isLandscape: width > height,
    /** Comfortable horizontal padding for the current width. */
    pad: isTablet ? 24 : 16,
    /** Two-column forms on wide screens. */
    wide: width >= 900,
  };
}
