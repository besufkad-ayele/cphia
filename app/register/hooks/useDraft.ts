'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { StoredPhoto } from '../types';

const DRAFT_DB = 'cphia-registration-db';
const DRAFT_STORE = 'register';
const PHOTO_KEY = 'draft-photo';
const UREPORT_KEY = 'draft-ureport';
const FAN_PHOTO_KEY = 'draft-fan-photo';
const FAN_PHOTO_BACK_KEY = 'draft-fan-photo-back';
const SECOND_ID_PHOTO_KEY = 'draft-second-id-photo';
const BANK_OWNER_PHOTO_KEY = 'draft-bank-owner-id-photo';

export const STORAGE_KEY = 'cphia-registration-draft-v2';
export const SESSION_KEY = 'cphia-registration-session-v1';
export const SUBMITTED_KEY = 'cphia-registration-submitted-v1';

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setBlobInDb(key: string, photo: StoredPhoto | null) {
  const db = await openDraftDb();
  const tx = db.transaction(DRAFT_STORE, 'readwrite');
  const store = tx.objectStore(DRAFT_STORE);
  if (photo) store.put(photo, key);
  else store.delete(key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlobFromDb(key: string): Promise<StoredPhoto | null> {
  const db = await openDraftDb();
  const tx = db.transaction(DRAFT_STORE, 'readonly');
  const store = tx.objectStore(DRAFT_STORE);
  const request = store.get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as StoredPhoto | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function useStoredBlob() {
  const [photo, setPhoto] = useState<StoredPhoto | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const hydrate = async (key: string) => {
    const saved = await getBlobFromDb(key);
    if (!saved) return;
    setPhoto(saved);
    const url = URL.createObjectURL(saved.blob);
    objectUrlRef.current = url;
    setPhotoUrl(url);
  };

  const setDraft = async (key: string, nextPhoto: StoredPhoto | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPhoto(nextPhoto);
    await setBlobInDb(key, nextPhoto);
    if (nextPhoto) {
      const url = URL.createObjectURL(nextPhoto.blob);
      objectUrlRef.current = url;
      setPhotoUrl(url);
    } else {
      setPhotoUrl(null);
    }
  };

  const revoke = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  };

  return { photo, photoUrl, hydrate, setDraft, revoke };
}

export function useDraft<TFieldValues extends FieldValues>(form: UseFormReturn<TFieldValues>) {
  const [hydrated, setHydrated] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedEmailSent, setSubmittedEmailSent] = useState(false);
  const timerRef = useRef<number | null>(null);
  const photoStore = useStoredBlob();
  const ureportStore = useStoredBlob();
  const fanPhotoStore = useStoredBlob();
  const fanPhotoBackStore = useStoredBlob();
  const secondIdPhotoStore = useStoredBlob();
  const bankOwnerPhotoStore = useStoredBlob();

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as Partial<TFieldValues>;
          form.reset({ ...form.getValues(), ...parsed });
        } catch {
          // noop
        }
      }

      const savedSubmitted = localStorage.getItem(SUBMITTED_KEY);
      if (savedSubmitted) {
        try {
          const parsed = JSON.parse(savedSubmitted) as { registrationId?: string; emailSent?: boolean };
          if (parsed.registrationId && mounted) {
            setSubmittedId(parsed.registrationId);
            setSubmittedEmailSent(Boolean(parsed.emailSent));
          }
        } catch {
          // noop
        }
      }

      if (!localStorage.getItem(SESSION_KEY)) {
        localStorage.setItem(SESSION_KEY, crypto.randomUUID());
      }

      try {
        await photoStore.hydrate(PHOTO_KEY);
        await ureportStore.hydrate(UREPORT_KEY);
        await fanPhotoStore.hydrate(FAN_PHOTO_KEY);
        await fanPhotoBackStore.hydrate(FAN_PHOTO_BACK_KEY);
        await secondIdPhotoStore.hydrate(SECOND_ID_PHOTO_KEY);
        await bankOwnerPhotoStore.hydrate(BANK_OWNER_PHOTO_KEY);
      } catch {
        // noop
      }

      if (mounted) setHydrated(true);
    };

    void boot();

    return () => {
      mounted = false;
      photoStore.revoke();
      ureportStore.revoke();
      fanPhotoStore.revoke();
      fanPhotoBackStore.revoke();
      secondIdPhotoStore.revoke();
      bankOwnerPhotoStore.revoke();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [form]);

  useEffect(() => {
    if (!hydrated) return;

    const subscription = form.watch((values) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      }, 400);
    });

    return () => subscription.unsubscribe();
  }, [form, hydrated]);

  return {
    hydrated,
    submittedId,
    setSubmittedId,
    submittedEmailSent,
    setSubmittedEmailSent,
    photo: photoStore.photo,
    photoUrl: photoStore.photoUrl,
    setDraftPhoto: (next: StoredPhoto | null) => photoStore.setDraft(PHOTO_KEY, next),
    ureportPhoto: ureportStore.photo,
    ureportUrl: ureportStore.photoUrl,
    setUreportPhoto: (next: StoredPhoto | null) => ureportStore.setDraft(UREPORT_KEY, next),
    fanPhoto: fanPhotoStore.photo,
    fanPhotoUrl: fanPhotoStore.photoUrl,
    setFanPhoto: (next: StoredPhoto | null) => fanPhotoStore.setDraft(FAN_PHOTO_KEY, next),
    fanPhotoBack: fanPhotoBackStore.photo,
    fanPhotoBackUrl: fanPhotoBackStore.photoUrl,
    setFanPhotoBack: (next: StoredPhoto | null) => fanPhotoBackStore.setDraft(FAN_PHOTO_BACK_KEY, next),
    secondIdPhoto: secondIdPhotoStore.photo,
    secondIdPhotoUrl: secondIdPhotoStore.photoUrl,
    setSecondIdPhoto: (next: StoredPhoto | null) => secondIdPhotoStore.setDraft(SECOND_ID_PHOTO_KEY, next),
    bankOwnerPhoto: bankOwnerPhotoStore.photo,
    bankOwnerPhotoUrl: bankOwnerPhotoStore.photoUrl,
    setBankOwnerPhoto: (next: StoredPhoto | null) => bankOwnerPhotoStore.setDraft(BANK_OWNER_PHOTO_KEY, next),
  };
}
