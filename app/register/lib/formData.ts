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
    fanPhotoBack?: StoredPhoto | null;
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
  function appendStored(key: string, stored: StoredPhoto) {
    const mime =
      stored.type
      || (/\.pdf$/i.test(stored.fileName) ? 'application/pdf' : 'image/jpeg');
    const file =
      stored.blob instanceof File && stored.blob.type
        ? stored.blob
        : new File([stored.blob], stored.fileName || 'upload.bin', {
            type: mime,
            lastModified: Date.now(),
          });
    formData.append(key, file, stored.fileName || file.name);
  }

  if (photo) appendStored('photo', photo);
  if (extras?.ureportScreenshot) appendStored('ureportScreenshot', extras.ureportScreenshot);
  if (extras?.fanPhoto) appendStored('fanPhoto', extras.fanPhoto);
  if (extras?.fanPhotoBack) appendStored('fanPhotoBack', extras.fanPhotoBack);
  if (extras?.secondIdPhoto) appendStored('secondIdPhoto', extras.secondIdPhoto);
  if (extras?.bankOwnerIdPhoto) appendStored('bankOwnerIdPhoto', extras.bankOwnerIdPhoto);

  return formData;
}
