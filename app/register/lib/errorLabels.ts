export const FIELD_LABEL_MAP: Record<string, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  amharicFirstName: 'Amharic first name',
  amharicMiddleName: 'Amharic middle name',
  amharicLastName: 'Amharic last name',
  fullNameAmharic: 'Full name (Amharic)',
  sex: 'Sex',
  age: 'Age',
  nationality: 'Nationality',
  fanNumber: 'FAN number',
  secondIdType: 'Second ID type',
  secondIdNumber: 'Second ID number',
  phone: 'Phone',
  secondaryPhone: 'Secondary phone',
  phoneIsWhatsApp: 'Phone is WhatsApp',
  whatsappNumber: 'WhatsApp number',
  whatsappNo: 'No WhatsApp',
  email: 'Email',
  confirmEmail: 'Confirm email',
  residenceRegion: 'Residence region',
  residenceCity: 'Residence city',
  residenceDetail: 'Residence detail',
  profession: 'Profession',
  educationLevel: 'Education level',
  emergencyName: 'Emergency contact name',
  emergencyPhone: 'Emergency contact phone',
  emergencyRelationship: 'Emergency relationship',
  languages: 'Languages',
  sector: 'Sector',
  healthSubsectors: 'Health sub-sector',
  bankName: 'Bank',
  bankAccountName: 'Account name',
  bankAccountNumber: 'Account number',
  bankAccountOtherOwner: 'Someone else owns this account',
  ureportRegistered: 'U-Report registration',
  agree: 'Consent agreement',
};

export function resolveFieldLabel(path: string): string {
  const root = path.split('.')[0] ?? path;
  if (FIELD_LABEL_MAP[root]) return FIELD_LABEL_MAP[root];
  return root
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}
