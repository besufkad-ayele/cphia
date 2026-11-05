"use client";

import { useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { StoredPhoto } from '../types';

const DRAFT_DB = 'cphia-registration-db';
const DRAFT_STORE = 'register';
const PHOTO_KEY = 'draft-photo';

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

async function setPhotoInDb(photo: StoredPhoto | null) {
  const db = await openDraftDb();
  const tx = db.transaction(DRAFT_STORE, 'readwrite');
  const store = tx.objectStore(DRAFT_STORE);
  if (photo) {
    store.put(photo, PHOTO_KEY);
  } else {
    store.delete(PHOTO_KEY);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhotoFromDb(): Promise<StoredPhoto | null> {
  const db = await openDraftDb();
  const tx = db.transaction(DRAFT_STORE, 'readonly');
  const store = tx.objectStore(DRAFT_STORE);
  const request = store.get(PHOTO_KEY);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as StoredPhoto | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function useDraft<TFieldValues extends FieldValues>(form: UseFormReturn<TFieldValues>) {
  const [hydrated, setHydrated] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<StoredPhoto | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);

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
          const parsed = JSON.parse(savedSubmitted) as { registrationId?: string };
          if (parsed.registrationId && mounted) setSubmittedId(parsed.registrationId);
        } catch {
          // noop
        }
      }

      if (!localStorage.getItem(SESSION_KEY)) {
        localStorage.setItem(SESSION_KEY, crypto.randomUUID());
      }

      try {
        const savedPhoto = await getPhotoFromDb();
        if (savedPhoto && mounted) {
          setPhoto(savedPhoto);
          const url = URL.createObjectURL(savedPhoto.blob);
          objectUrlRef.current = url;
          setPhotoUrl(url);
        }
      } catch {
        // noop
      }

      if (mounted) setHydrated(true);
    };

    void boot();

    return () => {
      mounted = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [form]);

  useEffect(() => {
    if (!hydrated) return;

    const subscription = form.watch((values) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      }, 400);
    });

    return () => subscription.unsubscribe();
  }, [form, hydrated]);

  const setDraftPhoto = async (nextPhoto: StoredPhoto | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setPhoto(nextPhoto);
    await setPhotoInDb(nextPhoto);

    if (nextPhoto) {
      const url = URL.createObjectURL(nextPhoto.blob);
      objectUrlRef.current = url;
      setPhotoUrl(url);
    } else {
      setPhotoUrl(null);
    }
  };

  return {
    hydrated,
    submittedId,
    setSubmittedId,
    photo,
    photoUrl,
    setDraftPhoto,
  };
}
