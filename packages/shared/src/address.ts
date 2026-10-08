/**
 * Address options, formatting and validation shared by the web checkout, the
 * mobile checkout and the API (which re-validates and normalizes every address).
 *
 * Only Canada and the United States are supported. Both use NANP phone numbers.
 */
import type { Address } from './index';

export const COUNTRIES = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
] as const;
export type CountryCode = (typeof COUNTRIES)[number]['code'];
export const DEFAULT_COUNTRY = 'Canada';

export interface Region {
  code: string;
  name: string;
}

export const REGIONS: Record<CountryCode, readonly Region[]> = {
  CA: [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'YT', name: 'Yukon' },
  ],
  US: [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'DC', name: 'District of Columbia' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
  ],
};

/** Suggestions only: any city name is accepted. Keyed by `${country}-${region}`. */
export const CITY_SUGGESTIONS: Record<string, readonly string[]> = {
  'CA-AB': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Airdrie', 'Medicine Hat', 'Grande Prairie'],
  'CA-BC': ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Victoria', 'Kelowna', 'Abbotsford', 'Coquitlam', 'Langley', 'Kamloops', 'Nanaimo'],
  'CA-MB': ['Winnipeg', 'Brandon', 'Steinbach', 'Thompson'],
  'CA-NB': ['Moncton', 'Saint John', 'Fredericton', 'Dieppe', 'Miramichi'],
  'CA-NL': ["St. John's", 'Mount Pearl', 'Corner Brook', 'Conception Bay South', 'Gander'],
  'CA-NS': ['Halifax', 'Dartmouth', 'Sydney', 'Truro', 'New Glasgow'],
  'CA-NT': ['Yellowknife', 'Hay River', 'Inuvik'],
  'CA-NU': ['Iqaluit', 'Rankin Inlet', 'Arviat'],
  'CA-ON': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Richmond Hill', 'Oakville', 'Burlington', 'Oshawa', 'Barrie', 'Guelph', 'Kingston', 'Waterloo', 'Sudbury', 'Thunder Bay'],
  'CA-PE': ['Charlottetown', 'Summerside', 'Stratford', 'Cornwall'],
  'CA-QC': ['Montréal', 'Québec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Lévis', 'Trois-Rivières', 'Terrebonne'],
  'CA-SK': ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current'],
  'CA-YT': ['Whitehorse', 'Dawson City', 'Watson Lake'],
  'US-CA': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Sacramento', 'Fresno', 'Oakland'],
  'US-NY': ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
  'US-TX': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso'],
  'US-FL': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg'],
  'US-IL': ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford'],
  'US-WA': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
  'US-PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'],
  'US-MI': ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing'],
  'US-MA': ['Boston', 'Worcester', 'Springfield', 'Cambridge'],
};

/** First letter of a Canadian postal code → the province(s) it belongs to. */
const CA_POSTAL_PREFIX: Record<string, readonly string[]> = {
  A: ['NL'], B: ['NS'], C: ['PE'], E: ['NB'], G: ['QC'], H: ['QC'], J: ['QC'],
  K: ['ON'], L: ['ON'], M: ['ON'], N: ['ON'], P: ['ON'],
  R: ['MB'], S: ['SK'], T: ['AB'], V: ['BC'], X: ['NT', 'NU'], Y: ['YT'],
};

const COUNTRY_ALIASES: Record<string, CountryCode> = {
  ca: 'CA', can: 'CA', canada: 'CA',
  us: 'US', usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'united states': 'US',
  'united states of america': 'US', america: 'US',
};

/** "canada", "CA", "can" → "CA". Undefined if not a supported country. */
export function countryCode(input: string | undefined): CountryCode | undefined {
  return input ? COUNTRY_ALIASES[input.trim().toLowerCase()] : undefined;
}

export function countryName(code: CountryCode): string {
  return COUNTRIES.find((c) => c.code === code)!.name;
}

/** "Ontario" / "ontario" / "ON" → "ON". Undefined if not a region of that country. */
export function regionCode(country: CountryCode | undefined, input: string | undefined): string | undefined {
  if (!country || !input) return undefined;
  const v = input.trim().toLowerCase();
  return REGIONS[country].find((r) => r.code.toLowerCase() === v || r.name.toLowerCase() === v)?.code;
}

export function citySuggestions(country: string | undefined, region: string | undefined): readonly string[] {
  const cc = countryCode(country);
  const rc = regionCode(cc, region);
  return (cc && rc && CITY_SUGGESTIONS[`${cc}-${rc}`]) || [];
}

/** Formats as the user types: "4165550123" → "(416) 555-0123". A leading +1 is dropped. */
export function formatPhone(input: string): string {
  let d = input.replace(/\D/g, '');
  // NANP area codes never start with 1, so a leading 1 is the country code.
  if (d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Formats as the user types: Canada "m5v2t6" → "M5V 2T6"; US "123456789" → "12345-6789". */
export function formatPostalCode(country: string | undefined, input: string): string {
  if (countryCode(country) === 'US') {
    const d = input.replace(/\D/g, '').slice(0, 9);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return s.length > 3 ? `${s.slice(0, 3)} ${s.slice(3)}` : s;
}

/** "north york" → "North York", "st. john's" → "St. John's". Leaves existing capitals alone. */
export function formatCity(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[ -])([a-zà-öø-ÿ])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function postalCodeLabel(country: string | undefined): string {
  return countryCode(country) === 'US' ? 'ZIP code' : 'Postal code';
}

export function regionLabel(country: string | undefined): string {
  return countryCode(country) === 'US' ? 'State' : 'Province / Territory';
}

const CA_POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/;
const US_ZIP = /^\d{5}(-\d{4})?$/;
const PHONE = /^\([2-9]\d{2}\) [2-9]\d{2}-\d{4}$/;
const CITY = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'’-]*$/;

export type AddressErrors = Partial<Record<keyof Address, string>>;

/** Field-level problems with an address (empty object when valid). Accepts unformatted input. */
export function validateAddress(a: Partial<Address>): AddressErrors {
  const errors: AddressErrors = {};
  const cc = countryCode(a.country);

  if (!a.line1?.trim()) errors.line1 = 'Enter a street address';

  const city = a.city?.trim();
  if (!city) errors.city = 'Enter a city';
  else if (!CITY.test(city)) errors.city = 'City can only contain letters, spaces, hyphens and apostrophes';

  if (!a.country?.trim()) errors.country = 'Choose a country';
  else if (!cc) errors.country = 'We deliver to Canada and the United States only';

  const rc = regionCode(cc, a.state);
  if (!a.state?.trim()) errors.state = `Choose a ${cc === 'US' ? 'state' : 'province'}`;
  else if (cc && !rc) errors.state = `Not a ${cc === 'US' ? 'US state' : 'Canadian province or territory'}`;

  const postal = a.postalCode?.trim() ? formatPostalCode(a.country, a.postalCode) : '';
  if (!postal) errors.postalCode = `Enter a ${postalCodeLabel(a.country).toLowerCase()}`;
  else if (cc === 'US' && !US_ZIP.test(postal)) errors.postalCode = 'ZIP code should look like 12345 or 12345-6789';
  else if (cc === 'CA' && !CA_POSTAL.test(postal)) errors.postalCode = 'Postal code should look like A1A 1A1';
  else if (cc === 'CA' && rc && !CA_POSTAL_PREFIX[postal[0]]?.includes(rc)) {
    errors.postalCode = `${postal.slice(0, 3)} isn't a postal code in ${REGIONS.CA.find((r) => r.code === rc)!.name}`;
  }

  if (a.phone?.trim() && !PHONE.test(formatPhone(a.phone))) {
    errors.phone = 'Enter a 10-digit phone number, e.g. (416) 555-0123';
  }
  return errors;
}

/** Canonical form of a valid address: country name, region code, formatted postal code and phone. */
export function normalizeAddress(a: Address): Address {
  const cc = countryCode(a.country);
  const clean = (v: string | undefined) => v?.trim() || undefined;
  return {
    label: clean(a.label),
    line1: a.line1.trim(),
    line2: clean(a.line2),
    city: formatCity(a.city),
    state: regionCode(cc, a.state) ?? a.state.trim(),
    postalCode: formatPostalCode(a.country, a.postalCode),
    country: cc ? countryName(cc) : a.country.trim(),
    phone: a.phone?.trim() ? formatPhone(a.phone) : undefined,
  };
}
