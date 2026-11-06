'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ALL_BANKS,
  EDUCATION_LEVELS,
  ETHIOPIA_REGIONS,
  ETHIOPIAN_LANGUAGES,
  HEALTH_SUBSECTORS,
  NATIONALITIES,
  SECTORS,
  SECOND_ID_TYPES,
  UN_LANGUAGES,
} from '@cphia/shared/constants';
import { ADMIN_STATUSES } from '@/app/lib/admin/status';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '@/app/lib/uploads';
import { href } from '@/lib/app-href';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Lang = { id: string; group: 'ethiopian' | 'un'; language: string; selected: boolean; proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native' };

const defaultLanguages = (): Lang[] => [
  ...UN_LANGUAGES.map((language) => ({
    id: crypto.randomUUID(),
    group: 'un' as const,
    language,
    selected: language === 'English',
    proficiency: 'Fluent' as const,
  })),
  ...ETHIOPIAN_LANGUAGES.map((language) => ({
    id: crypto.randomUUID(),
    group: 'ethiopian' as const,
    language,
    selected: language === 'Amharic',
    proficiency: (language === 'Amharic' ? 'Native' : 'Basic') as Lang['proficiency'],
  })),
];

function FilePicker({
  label,
  hint,
  accept,
  required,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? ' *' : ''}</Label>
      <p className="text-xs text-muted-foreground">{hint} · max {MAX_UPLOAD_LABEL}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => ref.current?.click()}>
          {file ? 'Replace file' : 'Choose file'}
        </Button>
        {file ? (
          <Button type="button" variant="ghost" className="h-11" onClick={() => onChange(null)}>Remove</Button>
        ) : null}
        <span className="text-sm text-muted-foreground">{file ? file.name : 'No file selected'}</span>
      </div>
      <input
        ref={ref}
        className="hidden"
        type="file"
        accept={accept}
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (!next) return;
          if (next.size > MAX_UPLOAD_BYTES) {
            toast.error(`${label} is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`);
            return;
          }
          onChange(next);
        }}
      />
    </div>
  );
}

const fieldClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function AdminRegisterVolunteerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Lang[]>(defaultLanguages);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fanPhoto, setFanPhoto] = useState<File | null>(null);
  const [fanPhotoBack, setFanPhotoBack] = useState<File | null>(null);
  const [secondIdPhoto, setSecondIdPhoto] = useState<File | null>(null);
  const [bankOwnerIdPhoto, setBankOwnerIdPhoto] = useState<File | null>(null);
  const [ureportScreenshot, setUreportScreenshot] = useState<File | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    amharicFirstName: '',
    amharicMiddleName: '',
    amharicLastName: '',
    sex: 'Male',
    age: '25',
    nationality: 'Ethiopian',
    fanNumber: '',
    secondIdType: '',
    secondIdNumber: '',
    phone: '+251',
    secondaryPhone: '',
    phoneIsWhatsApp: 'true',
    whatsappNumber: '',
    whatsappNo: 'false',
    email: '',
    confirmEmail: '',
    residenceRegion: 'Addis Ababa',
    residenceCity: 'Addis Ababa',
    residenceDetail: '',
    profession: '',
    educationLevel: "Bachelor's",
    emergencyName: '',
    emergencyPhone: '+251',
    emergencyRelationship: '',
    sector: 'Health',
    healthSubsector: 'Public Health',
    bankName: 'Commercial Bank of Ethiopia',
    bankAccountName: '',
    bankAccountNumber: '',
    bankAccountOtherOwner: 'false',
    ureportRegistered: 'false',
    reviewStatus: 'approved',
  });

  const selectedLanguageCount = useMemo(
    () => languages.filter((item) => item.selected).length,
    [languages],
  );

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => {
      if (key === 'sector' && value !== 'Health') {
        return { ...current, sector: value, healthSubsector: '' };
      }
      return { ...current, [key]: value };
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!photo) return setError('Volunteer photo is required.');
    if (!fanPhoto) return setError('National ID (front) is required.');
    if (form.email.trim() !== form.confirmEmail.trim()) return setError('Emails do not match.');
    if (selectedLanguageCount < 1) return setError('Select at least one language.');
    if (form.sector === 'Health' && !form.healthSubsector) return setError('Select a health sub-sector.');
    if (form.bankAccountOtherOwner === 'true' && !bankOwnerIdPhoto) {
      return setError('Upload the account owner ID photo.');
    }
    if (form.ureportRegistered === 'true' && !ureportScreenshot) {
      return setError('Upload the U-Report screenshot.');
    }
    if ((form.secondIdType || form.secondIdNumber) && !secondIdPhoto) {
      return setError('Upload the second ID photo.');
    }

    const fullNameAmharic = [form.amharicFirstName, form.amharicMiddleName, form.amharicLastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

    setSaving(true);
    const body = new FormData();
    const idempotencyKey = crypto.randomUUID();
    body.append('agree', 'true');
    body.append('idempotencyKey', idempotencyKey);
    body.append('uiLanguage', 'en');
    body.append('reviewStatus', form.reviewStatus);
    body.append('firstName', form.firstName.trim());
    body.append('middleName', form.middleName.trim());
    body.append('lastName', form.lastName.trim());
    body.append(
      'fullNameAmharic',
      fullNameAmharic || `${form.firstName.trim()} ${form.lastName.trim()}`,
    );
    body.append('sex', form.sex);
    body.append('age', form.age);
    body.append('nationality', form.nationality);
    body.append('fanNumber', form.fanNumber.replace(/\s/g, ''));
    body.append('secondIdType', form.secondIdType);
    body.append('secondIdNumber', form.secondIdNumber);
    body.append('phone', form.phone.trim());
    body.append('secondaryPhone', form.secondaryPhone.trim());
    body.append('phoneIsWhatsApp', form.phoneIsWhatsApp);
    body.append('whatsappNumber', form.whatsappNumber.trim());
    body.append('whatsappNo', form.whatsappNo);
    body.append('email', form.email.trim());
    body.append('confirmEmail', form.confirmEmail.trim());
    body.append('residenceRegion', form.residenceRegion);
    body.append('residenceCity', form.residenceCity.trim());
    body.append('residenceDetail', form.residenceDetail.trim());
    body.append('profession', form.profession.trim());
    body.append('educationLevel', form.educationLevel);
    body.append('emergencyName', form.emergencyName.trim());
    body.append('emergencyPhone', form.emergencyPhone.trim());
    body.append('emergencyRelationship', form.emergencyRelationship.trim());
    body.append('sector', form.sector);
    body.append(
      'healthSubsectors',
      JSON.stringify(form.sector === 'Health' && form.healthSubsector ? [form.healthSubsector] : []),
    );
    body.append('bankName', form.bankName);
    body.append('bankAccountName', form.bankAccountName.trim());
    body.append('bankAccountNumber', form.bankAccountNumber.trim());
    body.append('bankAccountOtherOwner', form.bankAccountOtherOwner);
    body.append('ureportRegistered', form.ureportRegistered);
    body.append('languages', JSON.stringify(languages));
    body.append('photo', photo, photo.name);
    body.append('fanPhoto', fanPhoto, fanPhoto.name);
    if (fanPhotoBack) body.append('fanPhotoBack', fanPhotoBack, fanPhotoBack.name);
    if (secondIdPhoto) body.append('secondIdPhoto', secondIdPhoto, secondIdPhoto.name);
    if (bankOwnerIdPhoto) body.append('bankOwnerIdPhoto', bankOwnerIdPhoto, bankOwnerIdPhoto.name);
    if (ureportScreenshot) body.append('ureportScreenshot', ureportScreenshot, ureportScreenshot.name);

    const response = await fetch('/api/admin/registrations', { method: 'POST', body });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      const code = payload?.error;
      if (code === 'DUPLICATE_EMAIL') setError('That email is already registered.');
      else if (code === 'DUPLICATE_FAN') setError('That FAN number is already registered.');
      else if (code === 'DUPLICATE_PHONE') setError('That phone number is already registered.');
      else if (code === 'PHOTO_TOO_LARGE') setError(`A file is too large. Maximum allowed is ${MAX_UPLOAD_LABEL}.`);
      else if (code === 'INVALID_PHOTO') setError('One of the files is not a supported image or PDF.');
      else if (code === 'INVALID_INPUT') setError('Check the form fields and try again.');
      else setError(payload?.message || 'Could not register this volunteer.');
      return;
    }

    toast.success(`Volunteer registered: ${payload.registrationId}`);
    router.push(href(`/admin/volunteers/${payload.id}`));
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={href('/admin/volunteers')} className={cn(buttonVariants({ variant: 'ghost' }), 'mb-2 h-9 px-0')}>
            Back to volunteers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Register volunteer</h1>
          <p className="text-sm text-muted-foreground">
            Full desk registration. Name order: given name, father name, grandfather name.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11" disabled={saving}>
            {saving ? 'Saving…' : 'Create volunteer'}
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Names follow Ethiopian order: my name · father · grandfather.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm">
            <span>Given name *</span>
            <Input className="h-11" required value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Father name</span>
            <Input className="h-11" value={form.middleName} onChange={(e) => setField('middleName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Grandfather name *</span>
            <Input className="h-11" required value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Given name (Amharic)</span>
            <Input className="h-11" value={form.amharicFirstName} onChange={(e) => setField('amharicFirstName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Father name (Amharic)</span>
            <Input className="h-11" value={form.amharicMiddleName} onChange={(e) => setField('amharicMiddleName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Grandfather name (Amharic)</span>
            <Input className="h-11" value={form.amharicLastName} onChange={(e) => setField('amharicLastName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Sex *</span>
            <select className={fieldClass} value={form.sex} onChange={(e) => setField('sex', e.target.value)}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Age *</span>
            <Input className="h-11" type="number" min={18} max={70} required value={form.age} onChange={(e) => setField('age', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Nationality *</span>
            <select className={fieldClass} value={form.nationality} onChange={(e) => setField('nationality', e.target.value)}>
              {NATIONALITIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span>FAN number *</span>
            <Input className="h-11" required inputMode="numeric" value={form.fanNumber} onChange={(e) => setField('fanNumber', e.target.value.replace(/\D/g, '').slice(0, 16))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Review status</span>
            <select className={fieldClass} value={form.reviewStatus} onChange={(e) => setField('reviewStatus', e.target.value)}>
              {ADMIN_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photos & IDs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FilePicker label="Volunteer photo" hint="JPG, PNG, or WEBP" accept="image/jpeg,image/png,image/webp" required file={photo} onChange={setPhoto} />
          <FilePicker label="National ID (front)" hint="JPG, PNG, WEBP, or PDF" accept="image/jpeg,image/png,image/webp,application/pdf" required file={fanPhoto} onChange={setFanPhoto} />
          <FilePicker label="National ID (back, optional)" hint="JPG, PNG, WEBP, or PDF" accept="image/jpeg,image/png,image/webp,application/pdf" file={fanPhotoBack} onChange={setFanPhotoBack} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span>Second ID type</span>
              <select className={fieldClass} value={form.secondIdType} onChange={(e) => setField('secondIdType', e.target.value)}>
                <option value="">None</option>
                {SECOND_ID_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span>Second ID number</span>
              <Input className="h-11" value={form.secondIdNumber} onChange={(e) => setField('secondIdNumber', e.target.value)} />
            </label>
          </div>
          {(form.secondIdType || form.secondIdNumber) ? (
            <FilePicker label="Second ID photo" hint="JPG, PNG, WEBP, or PDF" accept="image/jpeg,image/png,image/webp,application/pdf" required file={secondIdPhoto} onChange={setSecondIdPhoto} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact & residence</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span>Phone *</span>
            <Input className="h-11" required value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Secondary phone</span>
            <Input className="h-11" value={form.secondaryPhone} onChange={(e) => setField('secondaryPhone', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Phone is WhatsApp *</span>
            <select className={fieldClass} value={form.phoneIsWhatsApp} onChange={(e) => setField('phoneIsWhatsApp', e.target.value)}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          {form.phoneIsWhatsApp === 'false' ? (
            <label className="grid gap-1.5 text-sm">
              <span>WhatsApp number</span>
              <Input className="h-11" value={form.whatsappNumber} onChange={(e) => setField('whatsappNumber', e.target.value)} />
            </label>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span>Email *</span>
            <Input className="h-11" type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Confirm email *</span>
            <Input className="h-11" type="email" required value={form.confirmEmail} onChange={(e) => setField('confirmEmail', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Region *</span>
            <select className={fieldClass} value={form.residenceRegion} onChange={(e) => setField('residenceRegion', e.target.value)}>
              {ETHIOPIA_REGIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>City *</span>
            <Input className="h-11" required value={form.residenceCity} onChange={(e) => setField('residenceCity', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span>Residence detail *</span>
            <Input className="h-11" required value={form.residenceDetail} onChange={(e) => setField('residenceDetail', e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Background</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span>Profession *</span>
            <Input className="h-11" required value={form.profession} onChange={(e) => setField('profession', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Education *</span>
            <select className={fieldClass} value={form.educationLevel} onChange={(e) => setField('educationLevel', e.target.value)}>
              {EDUCATION_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Emergency name *</span>
            <Input className="h-11" required value={form.emergencyName} onChange={(e) => setField('emergencyName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Emergency phone *</span>
            <Input className="h-11" required value={form.emergencyPhone} onChange={(e) => setField('emergencyPhone', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span>Emergency relationship *</span>
            <Input className="h-11" required value={form.emergencyRelationship} onChange={(e) => setField('emergencyRelationship', e.target.value)} />
          </label>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Languages *</Label>
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
              {languages.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) => {
                      setLanguages((current) =>
                        current.map((row) => (row.id === item.id ? { ...row, selected: event.target.checked } : row)),
                      );
                    }}
                  />
                  <span className="min-w-0 flex-1">{item.language}</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={item.proficiency}
                    onChange={(event) => {
                      const proficiency = event.target.value as Lang['proficiency'];
                      setLanguages((current) =>
                        current.map((row) => (row.id === item.id ? { ...row, proficiency } : row)),
                      );
                    }}
                  >
                    <option value="Basic">Basic</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Native">Native</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sector & bank</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span>Sector *</span>
            <select className={fieldClass} value={form.sector} onChange={(e) => setField('sector', e.target.value)}>
              {SECTORS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          {form.sector === 'Health' ? (
            <label className="grid gap-1.5 text-sm">
              <span>Health sub-sector *</span>
              <select
                className={fieldClass}
                required
                value={form.healthSubsector}
                onChange={(e) => setField('healthSubsector', e.target.value)}
              >
                <option value="">Select</option>
                {HEALTH_SUBSECTORS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span>Bank *</span>
            <select className={fieldClass} value={form.bankName} onChange={(e) => setField('bankName', e.target.value)}>
              {ALL_BANKS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Account owner name *</span>
            <Input className="h-11" required value={form.bankAccountName} onChange={(e) => setField('bankAccountName', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Account number *</span>
            <Input className="h-11" required value={form.bankAccountNumber} onChange={(e) => setField('bankAccountNumber', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>Account owned by someone else</span>
            <select className={fieldClass} value={form.bankAccountOtherOwner} onChange={(e) => setField('bankAccountOtherOwner', e.target.value)}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          {form.bankAccountOtherOwner === 'true' ? (
            <div className="sm:col-span-2">
              <FilePicker label="Account owner ID" hint="JPG, PNG, WEBP, or PDF" accept="image/jpeg,image/png,image/webp,application/pdf" required file={bankOwnerIdPhoto} onChange={setBankOwnerIdPhoto} />
            </div>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span>U-Report registered</span>
            <select className={fieldClass} value={form.ureportRegistered} onChange={(e) => setField('ureportRegistered', e.target.value)}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          {form.ureportRegistered === 'true' ? (
            <div className="sm:col-span-2">
              <FilePicker label="U-Report screenshot" hint="JPG, PNG, WEBP, or PDF" accept="image/jpeg,image/png,image/webp,application/pdf" required file={ureportScreenshot} onChange={setUreportScreenshot} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-8">
        <Link href={href('/admin/volunteers')} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>Cancel</Link>
        <Button type="submit" className="h-11" disabled={saving}>{saving ? 'Saving…' : 'Create volunteer'}</Button>
      </div>
    </form>
  );
}
