export type VolunteerBadge = {
  registrationId: string;
  name: string;
  amharicName: string;
  sex: string;
  age: string;
  nationality: string;
  fanNumber: string;
  phone: string;
  sector: string;
  profession: string;
  residence: string;
  languages: string;
};

export const BADGE_STORAGE_KEY = 'cphia-registration-badge-v1';

export function readStoredBadge(): VolunteerBadge | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(BADGE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VolunteerBadge;
  } catch {
    return null;
  }
}

export function storeBadge(badge: VolunteerBadge) {
  localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(badge));
}
