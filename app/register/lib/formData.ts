import type { StoredPhoto } from '../types';
import type { RegistrationSubmissionPayload } from '../schema';

export function buildRegistrationFormData(
  payload: RegistrationSubmissionPayload,
  photo: StoredPhoto | null,
  extras?: {
    deviceTokenHash?: string;
    deviceFingerprintHash?: string;
    ureportScreenshot?: StoredPhoto | null;
    fanPhoto?: StoredPhoto | null;
    secondIdPhoto?: StoredPhoto | null;
    bankOwnerIdPhoto?: StoredPhoto | null;
  },
): FormData {
  const keys: { [K in keyof RegistrationSubmissionPayload]: true } = {
    agree: true,
    firstName: true,
    middleName: true,
    lastName: true,
    fullNameAmharic: true,
    sex: true,
    age: true,
    nationality: true,
    fanNumber: true,
    secondIdType: true,
    secondIdNumber: true,
    phone: true,
    secondaryPhone: true,
    phoneIsWhatsApp: true,
    whatsappNumber: true,
    whatsappNo: true,
    email: true,
    confirmEmail: true,
    residenceRegion: true,
    residenceCity: true,
    residenceDetail: true,
    profession: true,
    educationLevel: true,
    emergencyName: true,
    emergencyPhone: true,
    emergencyRelationship: true,
    languages: true,
    sector: true,
    healthSubsectors: true,
    bankName: true,
    bankAccountName: true,
    bankAccountNumber: true,
    bankAccountOtherOwner: true,
    ureportRegistered: true,
    uiLanguage: true,
    idempotencyKey: true,
  };
  void keys;

  const formData = new FormData();
  formData.append('agree', String(payload.agree));
  formData.append('firstName', payload.firstName);
  formData.append('middleName', payload.middleName);
  formData.append('lastName', payload.lastName);
  formData.append('fullNameAmharic', payload.fullNameAmharic);
  formData.append('sex', payload.sex);
  formData.append('age', String(payload.age));
  formData.append('nationality', payload.nationality);
  formData.append('fanNumber', payload.fanNumber);
  formData.append('secondIdType', payload.secondIdType);
  formData.append('secondIdNumber', payload.secondIdNumber);
  formData.append('phone', payload.phone);
  formData.append('secondaryPhone', payload.secondaryPhone);
  formData.append('phoneIsWhatsApp', String(payload.phoneIsWhatsApp));
  formData.append('whatsappNumber', payload.whatsappNumber);
  formData.append('whatsappNo', String(payload.whatsappNo));
  formData.append('email', payload.email);
  formData.append('confirmEmail', payload.confirmEmail);
  formData.append('residenceRegion', payload.residenceRegion);
  formData.append('residenceCity', payload.residenceCity);
  formData.append('residenceDetail', payload.residenceDetail);
  formData.append('profession', payload.profession);
  formData.append('educationLevel', payload.educationLevel);
  formData.append('emergencyName', payload.emergencyName);
  formData.append('emergencyPhone', payload.emergencyPhone);
  formData.append('emergencyRelationship', payload.emergencyRelationship);
  formData.append('sector', payload.sector);
  formData.append('healthSubsectors', JSON.stringify(payload.healthSubsectors));
  formData.append('bankName', payload.bankName);
  formData.append('bankAccountName', payload.bankAccountName);
  formData.append('bankAccountNumber', payload.bankAccountNumber);
  formData.append('bankAccountOtherOwner', String(payload.bankAccountOtherOwner));
  formData.append('ureportRegistered', String(payload.ureportRegistered));
  formData.append('languages', JSON.stringify(payload.languages));
  formData.append('uiLanguage', payload.uiLanguage);
  formData.append('idempotencyKey', payload.idempotencyKey);

  if (extras?.deviceTokenHash) {
    formData.append('deviceTokenHash', extras.deviceTokenHash);
  }
  if (extras?.deviceFingerprintHash) {
    formData.append('deviceFingerprintHash', extras.deviceFingerprintHash);
  }
  if (photo) {
    formData.append('photo', photo.blob, photo.fileName);
  }
  if (extras?.ureportScreenshot) {
    formData.append('ureportScreenshot', extras.ureportScreenshot.blob, extras.ureportScreenshot.fileName);
  }
  if (extras?.fanPhoto) {
    formData.append('fanPhoto', extras.fanPhoto.blob, extras.fanPhoto.fileName);
  }
  if (extras?.secondIdPhoto) {
    formData.append('secondIdPhoto', extras.secondIdPhoto.blob, extras.secondIdPhoto.fileName);
  }
  if (extras?.bankOwnerIdPhoto) {
    formData.append('bankOwnerIdPhoto', extras.bankOwnerIdPhoto.blob, extras.bankOwnerIdPhoto.fileName);
  }

  return formData;
}
