import type { AdminStatus } from './status';

export type RegistrationSummary = {
  id: string;
  registrationId: string;
  name: string;
  email: string;
  sector: string;
  residenceRegion: string;
  status: AdminStatus;
  createdAt: string;
  uiLanguage: string;
  phone: string;
  deviceFlag: string | null;
};

export type RegistrationMetrics = {
  total: number;
  pending: number;
  approved: number;
  review: number;
  flagged: number;
};
