'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FIELD_TYPES, FORM_STATUSES, type FieldType, type FormField } from '@/app/lib/admin/ops';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';

type Cohort = { id: string; name: string; code: string };
type ResponseRow = { id: string; volunteer_name: string; answers: Record<string, string | boolean>; created_at: string };
type FormRecord = { id: string; title: string; description: string; status: string; cohort_id: string | null; fields: FormField[] };
type Person = { id: string; registration_id: string; first_name: string; last_name: string };

export default function FormDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const payload = await adminFetch<{ form: FormRecord; responses: ResponseRow[]; cohorts: Cohort[] }>(`/api/admin/forms/${params.id}`);
    setForm({ ...payload.form, fields: Array.isArray(payload.form.fields) ? payload.form.fields : [] });
    setResponses(payload.responses);
    setCohorts(payload.cohorts);
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setMatches([]);
        return;
      }
      adminFetch<{ matches: Person[] }>(`/api/admin/attendance?q=${encodeURIComponent(query)}`)
        .then((payload) => setMatches(payload.matches))
        .catch(() => setMatches([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function updateField(id: string, partial: Partial<FormField>) {
    setForm((current) => current ? { ...current, fields: current.fields.map((field) => field.id === id ? { ...field, ...partial } : field) } : current);
  }

  async function save() {
    if (!form) return;
    try {
      await adminFetch(`/api/admin/forms/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          status: form.status,
          cohortId: form.cohort_id,
          fields: form.fields,
        }),
      });
      toast.success('Form saved.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the form.');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this form and its responses?')) return;
    try {
      await adminFetch(`/api/admin/forms/${params.id}`, { method: 'DELETE' });
      router.push(href('/admin/forms'));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the form.');
    }
  }

  async function record() {
    if (!form || !person) return;
    try {
      await adminFetch(`/api/admin/forms/${params.id}/responses`, {
        method: 'POST',
        body: JSON.stringify({
          registrationId: person.id,
          volunteerName: `${person.first_name} ${person.last_name}`,
          answers,
        }),
      });
      toast.success('Response recorded.');
      setPerson(null);
      setAnswers({});
      setQuery('');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not record the response.');
    }
  }

  if (!form) {
    return (
      <div className="grid gap-4">
        <PageHeader kicker="FORM" title="Form detail" />
        <Banner message={error} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader kicker="FORM DETAIL" title={form.title || 'Untitled form'} description="Write the questions, publish the form, then record a volunteer’s answers." />
      <Banner message={error} />
      <Card>
        <CardHeader><CardTitle>Form setup</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Title"><input className={controlClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="Status">
            <select className={controlClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {FORM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Cohort">
            <select className={controlClass} value={form.cohort_id || ''} onChange={(event) => setForm({ ...form, cohort_id: event.target.value || null })}>
              <option value="">No cohort</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description"><textarea className={`${controlClass} min-h-20 py-3`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Questions</CardTitle>
          <Button variant="outline" onClick={() => setForm({ ...form, fields: [...form.fields, { id: crypto.randomUUID(), label: '', type: 'short_text', required: false, options: [] }] })}>Add question</Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {form.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:grid-cols-2">
              <Field label={`Question ${index + 1}`}><input className={controlClass} value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} /></Field>
              <Field label="Type">
                <select className={controlClass} value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}>
                  {FIELD_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              {field.type === 'select' ? (
                <div className="md:col-span-2">
                  <Field label="Options, separated by commas">
                    <input className={controlClass} value={field.options.join(', ')} onChange={(event) => updateField(field.id, { options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                  </Field>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" className="size-4 accent-[#e7c15a]" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
                Required
              </label>
              <Button variant="ghost" className="justify-self-start" onClick={() => setForm({ ...form, fields: form.fields.filter((item) => item.id !== field.id) })}>Remove question</Button>
            </div>
          ))}
          {form.fields.length === 0 ? <p className="text-sm text-zinc-400">Add the first question.</p> : null}
          <div className="flex gap-2">
            <Button className="h-11" onClick={() => void save()}>Save form</Button>
            <Button variant="ghost" className="h-11" onClick={() => void remove()}>Delete form</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Record a response</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Find a volunteer">
            <input className={controlClass} value={person ? `${person.first_name} ${person.last_name}` : query} placeholder="Name or registration ID" onChange={(event) => { setPerson(null); setQuery(event.target.value); }} />
          </Field>
          {!person && matches.length > 0 ? (
            <div className="grid gap-1">
              {matches.map((match) => (
                <button key={match.id} type="button" className="rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => { setPerson(match); setQuery(''); setMatches([]); }}>
                  {match.first_name} {match.last_name} · {match.registration_id}
                </button>
              ))}
            </div>
          ) : null}
          {person ? form.fields.map((field) => (
            <Field key={field.id} label={field.label}>
              {field.type === 'long_text' ? (
                <textarea className={`${controlClass} min-h-20 py-3`} value={String(answers[field.id] ?? '')} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} />
              ) : field.type === 'checkbox' ? (
                <input type="checkbox" className="size-4 accent-[#e7c15a]" checked={Boolean(answers[field.id])} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.checked })} />
              ) : field.type === 'select' ? (
                <select className={controlClass} value={String(answers[field.id] ?? '')} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })}>
                  <option value="">Choose</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input className={controlClass} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={String(answers[field.id] ?? '')} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} />
              )}
            </Field>
          )) : null}
          <Button className="h-11 w-fit" disabled={!person} onClick={() => void record()}>Save response</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Responses</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {responses.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
              <p className="font-medium text-white">{row.volunteer_name}</p>
              <p className="text-xs text-zinc-500">{new Date(row.created_at).toLocaleString()}</p>
              <div className="mt-2 grid gap-1 text-zinc-300">
                {form.fields.map((field) => (
                  <p key={field.id}><span className="text-zinc-500">{field.label}: </span>{String(row.answers?.[field.id] ?? '—')}</p>
                ))}
              </div>
            </div>
          ))}
          {responses.length === 0 ? <p className="text-sm text-zinc-400">No responses yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
