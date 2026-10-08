import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  COUNTRIES,
  REGIONS,
  citySuggestions,
  countryCode,
  formatCity,
  formatPhone,
  formatPostalCode,
  postalCodeLabel,
  regionCode,
  regionLabel,
  type Address,
  type AddressErrors,
} from '@store/shared';
import { colors, ui } from '../theme';

export type AddressDraft = Partial<Address>;
export type Touched = Partial<Record<keyof Address, boolean>>;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={ui.muted}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Shipping address inputs: country and province are chips, cities are
 * suggested for the chosen province, and postal code / phone format as typed.
 */
export function AddressForm({
  value,
  onChange,
  errors,
  touched,
  onBlur,
}: {
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
  errors: AddressErrors;
  touched: Touched;
  onBlur: (field: keyof Address) => void;
}) {
  const cc = countryCode(value.country);
  const rc = regionCode(cc, value.state);
  const set = (patch: AddressDraft) => onChange({ ...value, ...patch });
  const err = (f: keyof Address) => (touched[f] ? errors[f] : undefined);

  const input = (f: keyof Address, props: TextInputProps) => (
    <TextInput
      style={[ui.input, err(f) && { borderColor: colors.danger }]}
      value={value[f] ?? ''}
      onBlur={() => onBlur(f)}
      {...props}
    />
  );

  const typedCity = value.city?.trim().toLowerCase() ?? '';
  const cities = citySuggestions(value.country, value.state)
    .filter((c) => c.toLowerCase().startsWith(typedCity) && c.toLowerCase() !== typedCity)
    .slice(0, 8);

  return (
    <View style={{ gap: 14 }}>
      <Field label="Street address *" error={err('line1')}>
        {input('line1', {
          placeholder: '123 King St W',
          onChangeText: (v) => set({ line1: v }),
          autoComplete: 'street-address',
        })}
      </Field>

      <Field label="Apartment, suite, buzzer (optional)">
        {input('line2', { placeholder: 'Unit 4, buzz 104', onChangeText: (v) => set({ line2: v }) })}
      </Field>

      <Field label="Country *" error={err('country')}>
        <View style={styles.chipRow}>
          {COUNTRIES.map((c) => (
            <Chip
              key={c.code}
              label={c.name}
              active={cc === c.code}
              onPress={() => {
                if (cc === c.code) return;
                // Province and postal code formats differ per country.
                set({ country: c.name, state: '', postalCode: '' });
              }}
            />
          ))}
        </View>
      </Field>

      <Field label={`${regionLabel(value.country)} *`} error={err('state')} hint={cc ? undefined : 'Choose a country first'}>
        {cc && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {REGIONS[cc].map((r) => (
              <Chip
                key={r.code}
                label={rc === r.code ? `${r.name} (${r.code})` : r.code}
                active={rc === r.code}
                onPress={() => {
                  set({ state: r.code });
                  onBlur('state');
                }}
              />
            ))}
          </ScrollView>
        )}
      </Field>

      <Field label="City *" error={err('city')}>
        {input('city', {
          placeholder: citySuggestions(value.country, value.state)[0] ?? 'City',
          onChangeText: (v) => set({ city: v }),
          onEndEditing: () => value.city && set({ city: formatCity(value.city) }),
          autoComplete: 'postal-address-locality',
          autoCapitalize: 'words',
        })}
        {cities.length > 0 && (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {cities.map((c) => (
              <Chip key={c} label={c} active={false} onPress={() => set({ city: c })} />
            ))}
          </ScrollView>
        )}
      </Field>

      <Field label={`${postalCodeLabel(value.country)} *`} error={err('postalCode')}>
        {input('postalCode', {
          placeholder: cc === 'US' ? '12345' : 'A1A 1A1',
          onChangeText: (v) => set({ postalCode: formatPostalCode(value.country, v) }),
          autoCapitalize: 'characters',
          autoCorrect: false,
          keyboardType: cc === 'US' ? 'number-pad' : 'default',
          autoComplete: 'postal-code',
        })}
      </Field>

      <Field label="Phone (optional)" error={err('phone')} hint="So the driver can reach you at the door.">
        {input('phone', {
          placeholder: '(416) 555-0123',
          onChangeText: (v) => set({ phone: formatPhone(v) }),
          keyboardType: 'phone-pad',
          autoComplete: 'tel',
          textContentType: 'telephoneNumber',
        })}
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  error: { fontSize: 13, color: colors.danger },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
});
