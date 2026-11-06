'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';

type Cohort = { id: string; name: string; code: string };
type FormRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  fieldCount: number;
  responses: number;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
};

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ forms: FormRow[]; cohorts: Cohort[] }>('/api/admin/forms')
      .then((payload) => {
        setForms(payload.forms);
        setCohorts(payload.cohorts);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  async function createForm() {
    try {
      const payload = await adminFetch<{ id: string }>('/api/admin/forms', {
        method: 'POST',
        body: JSON.stringify({ title, description, cohortId: cohortId || null, status: 'draft', fields: [] }),
      });
      router.push(href(`/admin/forms/${payload.id}`));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not create the form.');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader kicker="FORMS" title="Form builder" description="Briefings, checklists, and other questions the desk collects from volunteers." />
      <Banner message={error} />
      <Card>
        <CardHeader><CardTitle>New form</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Title"><input className={controlClass} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Cohort">
            <select className={controlClass} value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
              <option value="">No cohort</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="What this form is for"><textarea className={`${controlClass} min-h-20 py-3`} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          </div>
          <Button className="h-11 w-fit" onClick={() => void createForm()}>Create and design</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {forms.map((form) => {
          const cohort = Array.isArray(form.ops_cohorts) ? form.ops_cohorts[0] : form.ops_cohorts;
          return (
            <Link key={form.id} href={href(`/admin/forms/${form.id}`)}>
              <Card className="h-full transition hover:ring-[#e7c15a]/40">
                <CardHeader>
                  <CardTitle>{form.title}</CardTitle>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#e7c15a]">{form.status}{cohort ? ` · ${cohort.code}` : ''}</p>
                </CardHeader>
                <CardContent className="text-sm text-zinc-400">
                  <p>{form.description || 'No description yet.'}</p>
                  <p className="mt-2">{form.fieldCount} questions · {form.responses} responses</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
