export const ETHIOPIA_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Central Ethiopia',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'South Ethiopia',
  'South West Ethiopia',
  'Tigray',
] as const;

export type EthiopiaRegion = (typeof ETHIOPIA_REGIONS)[number];

export const NATIONALITIES = [
  'Ethiopian',
  'American',
  'British',
  'Canadian',
  'Chinese',
  'Egyptian',
  'Eritrean',
  'French',
  'German',
  'Indian',
  'Italian',
  'Japanese',
  'Kenyan',
  'Nigerian',
  'South African',
  'Sudanese',
  'Other',
] as const;
