import { resolveFieldLabel } from '@/app/register/lib/errorLabels';
import { MAX_UPLOAD_LABEL } from '@/app/lib/uploads';

export const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_DEVICE: 'This device has already submitted a registration.',
  DUPLICATE_EMAIL: 'This email is already registered.',
  DUPLICATE_PHONE: 'This phone number is already registered.',
  DUPLICATE_FAN: 'This FAN number is already registered.',
  DUPLICATE: 'This registration already exists. Please use your existing registration ID.',
  INVALID_FAN: 'FAN number must be a valid 16-digit Fayda Alias Number.',
  PHOTO_REQUIRED: 'A professional personal photo is required for the event ID.',
  FAN_PHOTO_REQUIRED: 'A photo of your national ID (front) is required.',
  SECOND_ID_PHOTO_REQUIRED: 'Upload a photo of the additional ID.',
  UREPORT_SCREENSHOT_REQUIRED: 'Upload your U-Report registration screenshot.',
  BANK_OWNER_ID_REQUIRED: 'Upload a photo of the account owner’s ID.',
  PHOTO_TOO_LARGE: `A file is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`,
  INVALID_PHOTO: 'One of the files is not a supported image or PDF. Use JPG, PNG, WEBP, HEIC, or PDF.',
  UPLOAD_FAILED: 'Could not save one of your files. Check your connection and try again.',
  INVALID_INPUT: 'Some form fields are invalid. Please review and correct them.',
  BODY_TOO_LARGE: `The upload is too large. Keep each file under ${MAX_UPLOAD_LABEL} and try again.`,
  NETWORK: 'Network problem while submitting. Check your connection and try again. Your draft is saved on this device.',
  TIMEOUT: 'The request took too long. Please try again.',
  REGISTRATION_FAILED: 'Registration could not be completed. Please try again. If it keeps failing, contact support.',
};

export function messageForRegisterCode(code: string | null | undefined, fallback?: string) {
  if (code && REGISTER_ERROR_MESSAGES[code]) return REGISTER_ERROR_MESSAGES[code];
  return fallback || REGISTER_ERROR_MESSAGES.REGISTRATION_FAILED;
}

type FlattenedZod = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

export function formatInvalidInputMessage(details: FlattenedZod | null | undefined) {
  const parts: string[] = [];
  for (const message of details?.formErrors ?? []) {
    if (message) parts.push(message);
  }
  for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
    const first = messages?.find(Boolean);
    if (!first) continue;
    parts.push(`${resolveFieldLabel(field)}: ${first}`);
  }
  if (!parts.length) return REGISTER_ERROR_MESSAGES.INVALID_INPUT;
  if (parts.length === 1) return parts[0];
  return `Please fix: ${parts.slice(0, 4).join(' · ')}${parts.length > 4 ? ` · +${parts.length - 4} more` : ''}`;
}

export function mapRpcFailure(error: { message?: string; code?: string; details?: string } | null | undefined) {
  const raw = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (/duplicate_email|email.*(already|exists|unique)/i.test(raw)) {
    return { error: 'DUPLICATE_EMAIL', message: REGISTER_ERROR_MESSAGES.DUPLICATE_EMAIL, status: 409 };
  }
  if (/duplicate_phone|phone.*(already|exists|unique)/i.test(raw)) {
    return { error: 'DUPLICATE_PHONE', message: REGISTER_ERROR_MESSAGES.DUPLICATE_PHONE, status: 409 };
  }
  if (/duplicate_fan|fan.*(already|exists|unique)/i.test(raw)) {
    return { error: 'DUPLICATE_FAN', message: REGISTER_ERROR_MESSAGES.DUPLICATE_FAN, status: 409 };
  }
  if (/duplicate_device|device.*(already|exists|unique)/i.test(raw)) {
    return { error: 'DUPLICATE_DEVICE', message: REGISTER_ERROR_MESSAGES.DUPLICATE_DEVICE, status: 409 };
  }
  if (/invalid_fan|fan/i.test(raw) && /invalid|length|digit/i.test(raw)) {
    return { error: 'INVALID_FAN', message: REGISTER_ERROR_MESSAGES.INVALID_FAN, status: 400 };
  }
  return {
    error: 'REGISTRATION_FAILED',
    message: REGISTER_ERROR_MESSAGES.REGISTRATION_FAILED,
    status: 500,
  };
}

/** Prefer server message, then known code, then status-based fallback — never a vague "busy" catch-all. */
export function resolveClientRegisterError(input: {
  status: number;
  online: boolean;
  body: { error?: string; message?: string; details?: FlattenedZod | unknown } | null;
  networkFailure?: boolean;
}) {
  if (input.networkFailure) {
    if (!input.online) return REGISTER_ERROR_MESSAGES.NETWORK.replace('Network problem while submitting.', 'No internet connection.');
    return REGISTER_ERROR_MESSAGES.NETWORK;
  }

  const code = input.body?.error;
  if (typeof input.body?.message === 'string' && input.body.message.trim()) {
    return input.body.message.trim();
  }
  if (code === 'INVALID_INPUT') {
    return formatInvalidInputMessage(input.body?.details as FlattenedZod | undefined);
  }
  if (code && REGISTER_ERROR_MESSAGES[code]) {
    return REGISTER_ERROR_MESSAGES[code];
  }
  if (input.status === 413) return REGISTER_ERROR_MESSAGES.BODY_TOO_LARGE;
  if (input.status === 408 || input.status === 504) return REGISTER_ERROR_MESSAGES.TIMEOUT;
  if (!input.online) return REGISTER_ERROR_MESSAGES.NETWORK.replace('Network problem while submitting.', 'No internet connection.');
  if (input.status >= 500) return REGISTER_ERROR_MESSAGES.REGISTRATION_FAILED;
  return REGISTER_ERROR_MESSAGES.REGISTRATION_FAILED;
}
