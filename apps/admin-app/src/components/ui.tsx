import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { OrderStatus } from '@store/shared';
import { STATUS_COLORS } from '../lib/format';
import { colors, ui } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        styles[`btn_${size}`],
        styles[`btn_${variant}`],
        pressed && { opacity: 0.85 },
        off && { opacity: 0.5 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.brand} />
      ) : (
        <Text style={[styles.btnText, styles[`btnText_${variant}`], size === 'sm' && { fontSize: 13 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone = 'stone' }: { label: string; tone?: 'stone' | 'rose' | 'amber' | 'emerald' }) {
  const t = {
    stone: ['#f5f5f4', '#57534e'],
    rose: ['#ffe4e6', '#be123c'],
    amber: ['#fef3c7', '#92400e'],
    emerald: ['#d1fae5', '#047857'],
  }[tone];
  return (
    <View style={{ backgroundColor: t[0], borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: t[1], fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{status}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
      {count !== undefined && (
        <View style={[styles.chipCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
          <Text style={[styles.chipCountText, active && { color: '#fff' }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** − value + control for stock levels. */
export function Stepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <View style={[ui.row, { gap: 6 }]}>
      <Pressable
        accessibilityLabel={`Decrease ${label}`}
        style={[styles.step, (disabled || value <= 0) && { opacity: 0.35 }]}
        disabled={disabled || value <= 0}
        onPress={() => onChange(-1)}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 36, textAlign: 'center', fontWeight: '700', fontSize: 15, color: value <= 5 ? colors.warning : colors.text }}>
        {value}
      </Text>
      <Pressable accessibilityLabel={`Increase ${label}`} style={[styles.step, disabled && { opacity: 0.35 }]} disabled={disabled} onPress={() => onChange(1)}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={ui.label}>{label}</Text>
      {children}
      {error ? <Text style={[ui.muted, { color: colors.danger, marginTop: 4 }]}>{error}</Text> : hint ? <Text style={[ui.muted, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Section({ title, subtitle, right, children, style }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ui.card, { gap: 12 }, style]}>
      <View style={[ui.row, { justifyContent: 'space-between', gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h3}>{title}</Text>
          {subtitle && <Text style={[ui.muted, { marginTop: 2 }]}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 4 }}>
      <Text style={[ui.h3, { color: colors.muted }]}>{title}</Text>
      {body && <Text style={[ui.muted, { textAlign: 'center' }]}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btn_sm: { paddingVertical: 8, paddingHorizontal: 14 },
  btn_md: { paddingVertical: 12, paddingHorizontal: 18 },
  btn_lg: { paddingVertical: 15, paddingHorizontal: 22 },
  btn_primary: { backgroundColor: colors.brand },
  btn_secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6d3d1' },
  btn_danger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecdd3' },
  btn_ghost: { backgroundColor: 'transparent' },
  btnText: { fontWeight: '700', fontSize: 15 },
  btnText_primary: { color: '#fff' },
  btnText_secondary: { color: colors.text },
  btnText_danger: { color: colors.danger },
  btnText_ghost: { color: colors.brandDark },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d6d3d1',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontWeight: '600', color: '#44403c' },
  chipCount: { backgroundColor: '#f5f5f4', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  chipCountText: { fontSize: 12, fontWeight: '700', color: '#57534e' },
  step: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6d3d1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 18, color: colors.text, fontWeight: '600' },
});
