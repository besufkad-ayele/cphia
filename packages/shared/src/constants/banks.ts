export const FEATURED_BANKS = [
  'Commercial Bank of Ethiopia',
  'Awash Bank',
  'Bank of Abyssinia',
  'Dashen Bank',
  'Cooperative Bank of Oromia',
] as const;

export const MORE_BANKS = [
  'Wegagen Bank',
  'Hibret Bank',
  'Nib International Bank',
  'United Bank',
  'Zemen Bank',
  'Enat Bank',
  'Addis International Bank',
  'Bunna Bank',
  'Oromia International Bank',
  'Siinqee Bank',
  'Tsehay Bank',
  'Goh Betoch Bank',
  'Amhara Bank',
  'Ahadu Bank',
  'Hijra Bank',
  'ZamZam Bank',
  'Sidama Bank',
  'Shabelle Bank',
  'Gadaa Bank',
] as const;

export const ALL_BANKS = [...FEATURED_BANKS, ...MORE_BANKS] as const;
export const RECOMMENDED_BANK = 'Commercial Bank of Ethiopia';

export type BankName = (typeof ALL_BANKS)[number];
