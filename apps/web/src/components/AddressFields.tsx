'use client';

import type { ReactNode } from 'react';
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

export type AddressDraft = Partial<Address>;

/**
 * Shipping address inputs. Country and province are dropdowns, cities are
 * suggested for the chosen province, and postal code / phone format as typed.
 * Errors appear per field once it has been `touched` (blurred or submitted).
 */
export function AddressFields({
  value,
  onChange,
  errors,
  touched,
  onBlur,
}: {
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
  errors: AddressErrors;
  touched: Partial<Record<keyof Address, boolean>>;
  onBlur: (field: keyof Address) => void;
}) {
  const cc = countryCode(value.country);
  const regions = cc ? REGIONS[cc] : [];
  const cities = citySuggestions(value.country, value.state);
  const set = (patch: AddressDraft) => onChange({ ...value, ...patch });

  const field = (name: keyof Address, label: string, input: ReactNode, opts: { span?: boolean; hint?: string; optional?: boolean } = {}) => {
    const error = touched[name] ? errors[name] : undefined;
    return (
      <label className={`space-y-1 text-sm ${opts.span ? 'sm:col-span-2' : ''}`}>
        <span className="text-stone-600">
          {label}
          {opts.optional ? <span className="text-stone-400"> (optional)</span> : ' *'}
        </span>
        {input}
        {error ? (
          <span id={`${name}-error`} className="block text-xs text-rose-600">
            {error}
          </span>
        ) : (
          opts.hint && <span className="block text-xs text-stone-400">{opts.hint}</span>
        )}
      </label>
    );
  };

  const inputProps = (name: keyof Address) => ({
    name,
    onBlur: () => onBlur(name),
    'aria-invalid': Boolean(touched[name] && errors[name]),
    'aria-describedby': touched[name] && errors[name] ? `${name}-error` : undefined,
    className: `input ${touched[name] && errors[name] ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field(
        'line1',
        'Street address',
        <input
          {...inputProps('line1')}
          value={value.line1 ?? ''}
          onChange={(e) => set({ line1: e.target.value })}
          autoComplete="address-line1"
          placeholder="123 King St W"
        />,
        { span: true },
      )}
      {field(
        'line2',
        'Apartment, suite, buzzer',
        <input
          {...inputProps('line2')}
          value={value.line2 ?? ''}
          onChange={(e) => set({ line2: e.target.value })}
          autoComplete="address-line2"
          placeholder="Unit 4, buzz 104"
        />,
        { span: true, optional: true },
      )}
      {field(
        'country',
        'Country',
        <select
          {...inputProps('country')}
          value={cc ? COUNTRIES.find((c) => c.code === cc)!.name : ''}
          onChange={(e) => {
            const next = countryCode(e.target.value);
            // Province and postal code formats differ per country.
            set({
              country: e.target.value,
              state: next && regionCode(next, value.state) ? value.state : '',
              postalCode: value.postalCode ? formatPostalCode(e.target.value, value.postalCode) : '',
            });
          }}
          autoComplete="country-name"
        >
          <option value="" disabled>
            Choose a country
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>,
      )}
      {field(
        'state',
        regionLabel(value.country),
        <select
          {...inputProps('state')}
          value={regionCode(cc, value.state) ?? ''}
          onChange={(e) => set({ state: e.target.value })}
          disabled={!cc}
          autoComplete="address-level1"
        >
          <option value="" disabled>
            {cc ? `Choose a ${cc === 'US' ? 'state' : 'province'}` : 'Choose a country first'}
          </option>
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>,
      )}
      {field(
        'city',
        'City',
        <>
          <input
            {...inputProps('city')}
            value={value.city ?? ''}
            onChange={(e) => set({ city: e.target.value })}
            onBlur={() => {
              if (value.city) set({ city: formatCity(value.city) });
              onBlur('city');
            }}
            list="city-suggestions"
            autoComplete="address-level2"
            placeholder={cities[0] ?? 'City'}
          />
          <datalist id="city-suggestions">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </>,
        { hint: cities.length ? 'Start typing or pick from the list' : undefined },
      )}
      {field(
        'postalCode',
        postalCodeLabel(value.country),
        <input
          {...inputProps('postalCode')}
          value={value.postalCode ?? ''}
          onChange={(e) => set({ postalCode: formatPostalCode(value.country, e.target.value) })}
          autoComplete="postal-code"
          inputMode={cc === 'US' ? 'numeric' : 'text'}
          autoCapitalize="characters"
          placeholder={cc === 'US' ? '12345' : 'A1A 1A1'}
        />,
      )}
      {field(
        'phone',
        'Phone',
        <input
          {...inputProps('phone')}
          value={value.phone ?? ''}
          onChange={(e) => set({ phone: formatPhone(e.target.value) })}
          type="tel"
          autoComplete="tel-national"
          inputMode="tel"
          placeholder="(416) 555-0123"
        />,
        { span: true, optional: true, hint: 'So the driver can reach you at the door.' },
      )}
    </div>
  );
}
