"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import imageCompression from 'browser-image-compression';

type LanguageEntry = {
  language: string;
  selected: boolean;
  proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
};

type FormState = {
  agree: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
  fullNameAmharic: string;
  amharicFirstName: string;
  amharicMiddleName: string;
  amharicLastName: string;
  sex: 'Male' | 'Female';
  age: string;
  nationality: string;
  fanNumber: string;
  secondIdType: string;
  secondIdNumber: string;
  phone: string;
  phoneIsWhatsApp: boolean;
  whatsappNumber: string;
  whatsappNo: boolean;
  email: string;
  confirmEmail: string;
  residenceRegion: string;
  residenceCity: string;
  residenceDetail: string;
  profession: string;
  educationLevel: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  languages: LanguageEntry[];
  sector: string;
  healthSubsectors: string[];
  photoName?: string;
  photoPreview?: string;
};

const STORAGE_KEY = 'cphia-registration-draft-v1';
const SESSION_KEY = 'cphia-registration-session-v1';
const SUBMITTED_KEY = 'cphia-registration-submitted-v1';

const nationalityOptions = [
  'Ethiopia',
  'Kenya',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'Burundi',
  'South Sudan',
  'Somalia',
  'Djibouti',
  'Eritrea',
  'Sudan',
  'Nigeria',
  'Ghana',
  'Senegal',
  'Other',
];

const professionSuggestions = [
  'Public Health Officer',
  'Medical Doctor',
  'Nurse',
  'Pharmacist',
  'Laboratory Scientist',
  'Researcher',
  'Health Informatics Specialist',
  'Community Health Worker',
  'Event Management',
  'Communications & Media',
  'Logistics Officer',
  'Protocol Officer',
  'Student',
  'Other',
];

const ethiopianLanguages = [
  'Amharic',
  'Afaan Oromo',
  'Tigrigna',
  'Somali',
  'Afar',
  'Sidama',
  'Wolaytta',
  'Gurage',
  'Hadiyya',
  'Gamo',
  'Kembata',
];

const unOfficialLanguages = ['Arabic', 'Chinese', 'English', 'French', 'Russian', 'Spanish'];

const createLanguageEntries = (): LanguageEntry[] => [
  ...ethiopianLanguages.map((language): LanguageEntry => ({
    language,
    selected: language === 'Amharic',
    proficiency: language === 'Amharic' ? 'Native' : 'Basic',
  })),
  ...unOfficialLanguages.map((language): LanguageEntry => ({
    language,
    selected: language === 'English',
    proficiency: language === 'English' ? 'Fluent' : 'Basic',
  })),
];

const sectorOptions = ['Health', 'Tourism', 'Culture and Sport', 'MoFA', 'UNICEF'];
const healthSubsectorOptions = ['Public Health', 'Food Safety', 'Pre-facility', 'Facility'];

const defaultForm: FormState = {
  agree: false,
  firstName: '',
  middleName: '',
  lastName: '',
  fullNameAmharic: '',
  amharicFirstName: '',
  amharicMiddleName: '',
  amharicLastName: '',
  sex: 'Male',
  age: '25',
  nationality: 'Ethiopia',
  fanNumber: '',
  secondIdType: 'Passport',
  secondIdNumber: '',
  phone: '+251',
  phoneIsWhatsApp: true,
  whatsappNumber: '',
  whatsappNo: false,
  email: '',
  confirmEmail: '',
  residenceRegion: 'Addis Ababa',
  residenceCity: 'Addis Ababa',
  residenceDetail: '',
  profession: '',
  educationLevel: 'Diploma',
  emergencyName: '',
  emergencyPhone: '+251',
  emergencyRelationship: '',
  languages: createLanguageEntries(),
  sector: 'Health',
  healthSubsectors: ['Public Health'],
  photoName: '',
  photoPreview: '',
};

const stepTitles = ['Consent', 'Personal Details', 'Background & Languages', 'Review'];

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setHydrated(true);

    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as Partial<FormState>;
        setForm({
          ...defaultForm,
          ...parsed,
          amharicFirstName: parsed.amharicFirstName ?? '',
          amharicMiddleName: parsed.amharicMiddleName ?? '',
          amharicLastName: parsed.amharicLastName ?? '',
          fullNameAmharic:
            parsed.fullNameAmharic ||
            [parsed.amharicFirstName ?? '', parsed.amharicMiddleName ?? '', parsed.amharicLastName ?? '']
              .filter(Boolean)
              .join(' ')
              .trim(),
          languages: parsed.languages?.length ? parsed.languages : defaultForm.languages,
        });
      } catch {
        // ignore invalid draft data
      }
    }

    const savedSubmitted = localStorage.getItem(SUBMITTED_KEY);
    if (savedSubmitted) {
      try {
        const parsed = JSON.parse(savedSubmitted) as { registrationId?: string };
        if (parsed.registrationId) {
          setSubmittedId(parsed.registrationId);
        }
      } catch {
        // ignore invalid saved result
      }
    }

    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, crypto.randomUUID());
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form, hydrated]);

  const filteredNationalities = useMemo(() => {
    const query = nationalitySearch.trim().toLowerCase();
    if (!query) return nationalityOptions;
    return nationalityOptions.filter((option) => option.toLowerCase().includes(query));
  }, [nationalitySearch]);

  const progress = useMemo(() => ((step + 1) / stepTitles.length) * 100, [step]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAmharicNameField = (field: 'amharicFirstName' | 'amharicMiddleName' | 'amharicLastName', value: string) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      } as FormState;
      next.fullNameAmharic = [next.amharicFirstName, next.amharicMiddleName, next.amharicLastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      return next;
    });
  };

  const updateLanguageInList = (languageName: string, updates: Partial<LanguageEntry>) => {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.map((item) =>
        item.language === languageName ? { ...item, ...updates } : item,
      ),
    }));
  };

  const addLanguageRow = () => {
    updateField('languages', [...form.languages, { language: '', selected: false, proficiency: 'Basic' }]);
  };

  const onPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        initialQuality: 0.8,
        useWebWorker: true,
      });

      const imageUrl = URL.createObjectURL(compressed);
      updateField('photoName', compressed.name);
      updateField('photoPreview', imageUrl);
    } catch {
      setError('Photo could not be processed. Please try a different image.');
    }
  };

  const validateFanNumber = (fan: string) => /^\d{10,}$/.test(fan.replace(/\s+/g, ''));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    if (!validateFanNumber(form.fanNumber)) {
      setError('National ID / FAN number must be a valid number with at least 10 digits.');
      setIsSubmitting(false);
      return;
    }

    if (form.email.trim() !== form.confirmEmail.trim() || !form.email.includes('@')) {
      setError('Email and confirm email must match exactly.');
      setIsSubmitting(false);
      return;
    }

    if (!form.phoneIsWhatsApp && !form.whatsappNo && !form.whatsappNumber.trim()) {
      setError('Please enter a WhatsApp number or select “I don’t use WhatsApp”.');
      setIsSubmitting(false);
      return;
    }

    try {
      const selectedLanguages = form.languages.filter((item) => item.selected && item.language.trim().length > 0);
      const payload = new FormData();
      payload.append('agree', String(form.agree));
      payload.append('firstName', form.firstName);
      payload.append('middleName', form.middleName);
      payload.append('lastName', form.lastName);
      payload.append('fullNameAmharic', form.fullNameAmharic || [form.amharicFirstName, form.amharicMiddleName, form.amharicLastName].filter(Boolean).join(' '));
      payload.append('sex', form.sex);
      payload.append('age', String(Number(form.age || 0)));
      payload.append('nationality', form.nationality || 'Ethiopia');
      payload.append('fanNumber', form.fanNumber);
      payload.append('secondIdType', form.secondIdType);
      payload.append('secondIdNumber', form.secondIdNumber);
      payload.append('phone', form.phone);
      payload.append('phoneIsWhatsApp', String(form.phoneIsWhatsApp));
      payload.append('whatsappNumber', form.phoneIsWhatsApp ? '' : form.whatsappNumber);
      payload.append('whatsappNo', String(form.whatsappNo));
      payload.append('email', form.email);
      payload.append('confirmEmail', form.confirmEmail);
      payload.append('residenceRegion', form.residenceRegion);
      payload.append('residenceCity', form.residenceCity);
      payload.append('residenceDetail', form.residenceDetail);
      payload.append('profession', form.profession);
      payload.append('educationLevel', form.educationLevel);
      payload.append('emergencyName', form.emergencyName);
      payload.append('emergencyPhone', form.emergencyPhone);
      payload.append('emergencyRelationship', form.emergencyRelationship);
      payload.append('sector', form.sector);
      payload.append('healthSubsectors', JSON.stringify(form.healthSubsectors));
      payload.append('languages', JSON.stringify(selectedLanguages));
      payload.append('idempotencyKey', localStorage.getItem(SESSION_KEY) ?? crypto.randomUUID());

      if (form.photoPreview) {
        const responsePhoto = await fetch(form.photoPreview);
        const blob = await responsePhoto.blob();
        payload.append('photo', blob, form.photoName || 'volunteer-photo.jpg');
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        body: payload,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Registration failed');
      }

      const registrationId = result.registrationId ?? 'CPHIA-26-000001';
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ registrationId, at: new Date().toISOString() }));
      localStorage.removeItem(STORAGE_KEY);
      setSubmittedId(registrationId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <main style={pageShellStyle}>
        <div style={cardStyle}>
          <p style={eyebrowStyle}>Registration complete</p>
          <h1 style={{ margin: '0.5rem 0', fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>You are registered</h1>
          <p style={{ margin: 0, color: '#374151', lineHeight: 1.7 }}>
            Your registration ID is <strong>{submittedId}</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(SUBMITTED_KEY);
              setSubmittedId(null);
            }}
            style={{ ...primaryButtonStyle, marginTop: 18 }}
          >
            Start again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageShellStyle}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <header style={{ marginBottom: 16 }}>
          <p style={eyebrowStyle}>CPHIA Facility Volunteer Training</p>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 16 }}>Step {step + 1} of {stepTitles.length}</strong>
            <span style={{ fontSize: 12 }}>{stepTitles[step]}</span>
          </div>
          <div style={{ marginTop: 10, height: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 999 }}>
            <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #D4AF37, #F5C518)' }} />
          </div>
        </header>

        <section style={cardStyle}>
          {step === 0 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 2.8rem)' }}>Volunteer Registration</h1>
                <p style={{ marginTop: 10, color: '#374151', lineHeight: 1.6 }}>
                  Please complete this form once from this device. After you submit, it cannot be edited or resubmitted.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontWeight: 600, lineHeight: 1.6 }}>
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={(e) => updateField('agree', e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 2 }}
                />
                <span>
                  I confirm that I will fill and submit this form only once from this device, and I understand that after submission I cannot edit or resubmit.
                </span>
              </label>

              <button type="button" disabled={!form.agree} onClick={() => setStep(1)} style={{ ...primaryButtonStyle, opacity: form.agree ? 1 : 0.7 }}>
                Agree and Start
              </button>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <h2 style={{ margin: 0 }}>Personal Information</h2>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <Field label="First name (English)" value={form.firstName} onChange={(v) => updateField('firstName', v)} />
                <Field label="Middle name (English)" value={form.middleName} onChange={(v) => updateField('middleName', v)} />
                <Field label="Last name (English)" value={form.lastName} onChange={(v) => updateField('lastName', v)} />
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <Field label="First name (Amharic)" value={form.amharicFirstName} onChange={(v) => updateAmharicNameField('amharicFirstName', v)} />
                <Field label="Middle name (Amharic)" value={form.amharicMiddleName} onChange={(v) => updateAmharicNameField('amharicMiddleName', v)} />
                <Field label="Last name (Amharic)" value={form.amharicLastName} onChange={(v) => updateAmharicNameField('amharicLastName', v)} />
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #dfe7f0', borderRadius: 14, padding: '0.8rem 1rem' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: 700 }}>Full Amharic name preview</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {form.fullNameAmharic || 'Enter the full Amharic name to preview here'}
                </p>
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <SelectField label="Sex" value={form.sex} options={['Male', 'Female']} onChange={(v) => updateField('sex', v as 'Male' | 'Female')} />
                <Field label="Age (18–70)" type="number" value={form.age} onChange={(v) => updateField('age', v)} />
                <div>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>Nationality</span>
                    <input
                      value={nationalitySearch || form.nationality}
                      onChange={(e) => {
                        setNationalitySearch(e.target.value);
                        if (e.target.value.trim() === '') {
                          updateField('nationality', 'Ethiopia');
                        }
                      }}
                      placeholder="Search nationality"
                      style={inputStyle}
                    />
                  </label>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {filteredNationalities.slice(0, 8).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          updateField('nationality', option);
                          setNationalitySearch('');
                        }}
                        style={{
                          ...chipStyle,
                          background: form.nationality === option ? '#dff7f0' : '#f3f4f6',
                          borderColor: form.nationality === option ? '#2dae95' : '#d1d5db',
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Field label="National ID / FAN Number" value={form.fanNumber} onChange={(v) => updateField('fanNumber', v)} />

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <SelectField label="Optional second ID type" value={form.secondIdType} options={['Passport', 'Kebele ID', "Driver's license", 'Other']} onChange={(v) => updateField('secondIdType', v)} />
                <Field label="Second ID number" value={form.secondIdNumber} onChange={(v) => updateField('secondIdNumber', v)} />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Personal photo (optional)</span>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} />
                {form.photoPreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <img src={form.photoPreview} alt="Volunteer preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 16, border: '1px solid #d1d5db' }} />
                    <span style={{ color: '#374151' }}>{form.photoName || 'Uploaded image'}</span>
                  </div>
                )}
              </div>

              <Field label="Phone number (international format)" type="tel" value={form.phone} onChange={(v) => updateField('phone', v)} />

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <SelectField label="Is this number on WhatsApp?" value={form.phoneIsWhatsApp ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={(v) => {
                  const next = v === 'Yes';
                  updateField('phoneIsWhatsApp', next);
                  if (next) {
                    updateField('whatsappNo', false);
                  }
                }} />
                {!form.phoneIsWhatsApp && (
                  <Field label="WhatsApp number" value={form.whatsappNumber} onChange={(v) => updateField('whatsappNumber', v)} />
                )}
              </div>

              {!form.phoneIsWhatsApp && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.whatsappNo}
                    onChange={(e) => {
                      updateField('whatsappNo', e.target.checked);
                      if (e.target.checked) updateField('whatsappNumber', '');
                    }}
                  />
                  I don’t use WhatsApp
                </label>
              )}

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <Field label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
                <Field label="Confirm email" type="email" value={form.confirmEmail} onChange={(v) => updateField('confirmEmail', v)} onPaste={(e) => e.preventDefault()} />
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <SelectField label="Residence region" value={form.residenceRegion} options={['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'SNNP', 'Afar', 'Benishangul-Gumuz', 'Somali', 'Harari', 'Dire Dawa']} onChange={(v) => updateField('residenceRegion', v)} />
                <Field label="City" value={form.residenceCity} onChange={(v) => updateField('residenceCity', v)} />
              </div>

              <Field label="Sub-city / woreda / area" value={form.residenceDetail} onChange={(v) => updateField('residenceDetail', v)} />

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setStep(0)} style={secondaryButtonStyle}>Back</button>
                <button type="button" onClick={() => setStep(2)} style={primaryButtonStyle}>Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <h2 style={{ margin: 0 }}>Background & Languages</h2>

              <div style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Profession</span>
                  <input
                    value={form.profession}
                    list="profession-suggestions"
                    onChange={(e) => updateField('profession', e.target.value)}
                    style={inputStyle}
                  />
                  <datalist id="profession-suggestions">
                    {professionSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </label>
              </div>

              <SelectField label="Education level" value={form.educationLevel} options={['Certificate', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other']} onChange={(v) => updateField('educationLevel', v)} />

              <Field label="Emergency contact: full name" value={form.emergencyName} onChange={(v) => updateField('emergencyName', v)} />
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <Field label="Emergency phone" type="tel" value={form.emergencyPhone} onChange={(v) => updateField('emergencyPhone', v)} />
                <Field label="Relationship" value={form.emergencyRelationship} onChange={(v) => updateField('emergencyRelationship', v)} />
              </div>

              <div>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 18 }}>Language checklist</p>
                <p style={{ margin: '0 0 14px', color: '#475569', lineHeight: 1.6 }}>
                  Select the languages you can speak and choose the level that best matches your communication ability.
                </p>

                <div style={{ display: 'grid', gap: 18 }}>
                  <LanguageGroup label="Ethiopian languages" languages={form.languages.filter((item) => ethiopianLanguages.includes(item.language))} onChange={(languageName, next) => {
                    setForm((prev) => ({
                      ...prev,
                      languages: prev.languages.map((item) =>
                        item.language === languageName ? { ...item, ...next } : item,
                      ),
                    }));
                  }} />
                  <LanguageGroup label="UN official languages" languages={form.languages.filter((item) => unOfficialLanguages.includes(item.language))} onChange={(languageName, next) => {
                    setForm((prev) => ({
                      ...prev,
                      languages: prev.languages.map((item) =>
                        item.language === languageName ? { ...item, ...next } : item,
                      ),
                    }));
                  }} />
                  <LanguageGroup label="Other languages" languages={form.languages.filter((item) => !ethiopianLanguages.includes(item.language) && !unOfficialLanguages.includes(item.language))} onChange={(languageName, next) => {
                    setForm((prev) => ({
                      ...prev,
                      languages: prev.languages.map((item) =>
                        item.language === languageName ? { ...item, ...next } : item,
                      ),
                    }));
                  }} />
                </div>

                <button type="button" onClick={addLanguageRow} style={{ ...secondaryButtonStyle, marginTop: 12 }}>
                  Add another language
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setStep(1)} style={secondaryButtonStyle}>Back</button>
                <button type="button" onClick={() => setStep(3)} style={primaryButtonStyle}>Review</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <h2 style={{ margin: 0 }}>Sector & Review</h2>

              <div style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Sector</span>
                  <select value={form.sector} onChange={(e) => updateField('sector', e.target.value)} style={inputStyle}>
                    {sectorOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                {form.sector === 'Health' && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <span style={{ fontWeight: 600 }}>Health sub-sector (select one)</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {healthSubsectorOptions.map((item) => {
                        const checked = form.healthSubsectors.includes(item);
                        return (
                          <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, background: checked ? '#dff7f0' : '#f3f4f6', border: `1px solid ${checked ? '#2dae95' : '#d1d5db'}`, borderRadius: 999, padding: '0.5rem 0.8rem', fontWeight: 600 }}>
                            <input
                              type="radio"
                              name="health-subsector"
                              checked={checked}
                              onChange={() => {
                                updateField('healthSubsectors', [item]);
                              }}
                            />
                            {item}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 8, color: '#374151' }}>
                <p><strong>Name:</strong> {form.firstName} {form.middleName} {form.lastName}</p>
                <p><strong>Amharic name:</strong> {form.fullNameAmharic || 'Not provided yet'}</p>
                <p><strong>Sex:</strong> {form.sex}</p>
                <p><strong>Nationality:</strong> {form.nationality}</p>
                <p><strong>Phone:</strong> {form.phone}</p>
                <p><strong>Email:</strong> {form.email}</p>
                <p><strong>Residence:</strong> {form.residenceRegion} / {form.residenceCity}</p>
                <p><strong>Sector:</strong> {form.sector}</p>
                {form.sector === 'Health' && <p><strong>Health sub-sector:</strong> {form.healthSubsectors.join(', ')}</p>}
                <p><strong>Languages:</strong> {form.languages.filter((item) => item.selected && item.language.trim()).map((item) => `${item.language} (${item.proficiency})`).join(', ') || 'None selected'}</p>
                {form.photoPreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={form.photoPreview} alt="Volunteer review" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid #d1d5db' }} />
                    <span>Photo uploaded</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>Edit sections</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <EditLink label="Personal" onClick={() => setStep(1)} />
                    <EditLink label="Background" onClick={() => setStep(2)} />
                    <EditLink label="Sector" onClick={() => setStep(3)} />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setStep(2)} style={secondaryButtonStyle}>Back</button>
                <button type="button" onClick={handleSubmit} disabled={isSubmitting} aria-busy={isSubmitting} style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.75 : 1, minWidth: 180 }}> 
                  {isSubmitting ? 'Submitting…' : 'Submit Registration'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  type = 'text',
  onChange,
  onPaste,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        style={inputStyle}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LanguageGroup({
  label,
  languages,
  onChange,
}: {
  label: string;
  languages: LanguageEntry[];
  onChange: (languageName: string, next: Partial<LanguageEntry>) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10, border: '1px solid #e2e8f0', borderRadius: 16, background: '#f8fafc', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontWeight: 800 }}>{label}</p>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{languages.length} item{languages.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {languages.map((language, index) => (
          <div key={`${label}-${language.language}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.6rem 0.75rem' }}>
            <input
              type="checkbox"
              checked={language.selected}
              onChange={(e) => onChange(language.language, { selected: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ minWidth: 130, fontWeight: 600 }}>{language.language || 'Custom language'}</span>
            <select
              value={language.proficiency}
              disabled={!language.selected}
              onChange={(e) => onChange(language.language, { proficiency: e.target.value as LanguageEntry['proficiency'] })}
              style={{ minWidth: 150, minHeight: 40, borderRadius: 10, border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', background: language.selected ? '#fff' : '#f1f5f9' }}
            >
              <option value="Basic">Basic</option>
              <option value="Conversational">Conversational</option>
              <option value="Fluent">Fluent</option>
              <option value="Native">Native</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid #d1d5db',
        borderRadius: 999,
        background: '#f3f4f6',
        padding: '0.45rem 0.75rem',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const pageShellStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #186059, #2DAE95)',
  color: '#fff',
  padding: '1.25rem 1rem 2rem',
};

const cardStyle: CSSProperties = {
  background: '#fff',
  color: '#111',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  fontWeight: 700,
};

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  background: 'linear-gradient(135deg, #D4AF37, #F5C518)',
  color: '#111',
  fontWeight: 800,
  padding: '0.9rem 1.3rem',
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 12,
  background: '#f3f4f6',
  color: '#111',
  fontWeight: 700,
  padding: '0.9rem 1.3rem',
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 46,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  padding: '0.7rem 0.8rem',
  fontSize: 16,
  color: '#111',
  background: '#fff',
};

const chipStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 999,
  background: '#f3f4f6',
  padding: '0.45rem 0.8rem',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
