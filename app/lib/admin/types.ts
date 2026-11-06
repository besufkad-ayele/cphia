import type { AdminStatus } from './status';

export type RegistrationSummary = {
  id: string;
  registrationId: string;
  name: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  fanNumber: string;
  sector: string;
  healthSubsectors?: string[];
  residenceRegion: string;
  status: AdminStatus;
  createdAt: string;
  uiLanguage: string;
  deviceFlag: string | null;
  bankName: string;
  cohort: string;
};

export type RegistrationMetrics = {
  total: number;
  pending: number;
  approved: number;
  review: number;
  flagged: number;
};

export const EXPORT_COLUMNS = [
  { id: 'registration_id', label: 'Registration ID' },
  { id: 'first_name', label: 'First name' },
  { id: 'middle_name', label: 'Middle name' },
  { id: 'last_name', label: 'Last name' },
  { id: 'full_name_amharic', label: 'Full name (Amharic)' },
  { id: 'sex', label: 'Sex' },
  { id: 'age', label: 'Age' },
  { id: 'nationality', label: 'Nationality' },
  { id: 'fan_number', label: 'FAN number' },
  { id: 'second_id_type', label: 'Second ID type' },
  { id: 'second_id_number', label: 'Second ID number' },
  { id: 'phone', label: 'Phone' },
  { id: 'secondary_phone', label: 'Secondary phone' },
  { id: 'whatsapp_number', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'residence_region', label: 'Region' },
  { id: 'residence_detail', label: 'Residence detail' },
  { id: 'profession', label: 'Profession' },
  { id: 'education_level', label: 'Education' },
  { id: 'emergency_name', label: 'Emergency name' },
  { id: 'emergency_phone', label: 'Emergency phone' },
  { id: 'emergency_relationship', label: 'Emergency relationship' },
  { id: 'sector', label: 'Sector' },
  { id: 'health_subsectors', label: 'Health sub-sector' },
  { id: 'bank_name', label: 'Bank' },
  { id: 'bank_account_name', label: 'Account owner name' },
  { id: 'bank_account_number', label: 'Account number' },
  { id: 'bank_account_other_owner', label: 'Account owned by someone else' },
  { id: 'ureport_registered', label: 'U-Report registered' },
  { id: 'review_status', label: 'Status' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'created_at', label: 'Submitted' },
] as const;
