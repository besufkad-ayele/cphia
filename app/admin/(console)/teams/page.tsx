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
type Admin = { id: string; full_name: string | null; email: string };
type Team = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
  members: number;
  supervisor_admin_id: string | null;
  ops_cohorts: { name: string; code: string } | { name: string; code: string }[] | null;
};

const empty = { name: '', code: '', cohortId: '', description: '', supervisorAdminId: '' };

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const payload = await adminFetch<{ teams: Team[]; cohorts: Cohort[]; admins: Admin[] }>('/api/admin/teams');
    setTeams(payload.teams);
    setCohorts(payload.cohorts);
    setAdmins(payload.admins);
    setForm((current) => ({ ...current, cohortId: current.cohortId || payload.cohorts[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function createTeam() {
    try {
      const payload = await adminFetch<{ id: string }>('/api/admin/teams', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('Team created.');
      router.push(href(`/admin/teams/${payload.id}`));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not create the team.');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="FLOOR TEAMS"
        title="Teams"
        description="Create Protocol, Crowd Marshal, Registration… Assign a Floor supervisor account (Team → create user with that role), then promote zone captains on the roster for information only."
      />
      <Banner message={error} />
      <Card>
        <CardHeader><CardTitle>New team</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Event / cohort">
            <select className={controlClass} value={form.cohortId} onChange={(event) => setForm({ ...form, cohortId: event.target.value })}>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.code} · {cohort.name}</option>)}
            </select>
          </Field>
          <Field label="Name"><input className={controlClass} value={form.name} placeholder="Protocol" onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Code"><input className={controlClass} value={form.code} placeholder="PROT" onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Supervisor">
            <select className={controlClass} value={form.supervisorAdminId} onChange={(event) => setForm({ ...form, supervisorAdminId: event.target.value })}>
              <option value="">Assign later</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>{admin.full_name || admin.email}</option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Detail"><textarea className={`${controlClass} min-h-20 py-3`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>
          <Button className="h-11 w-fit" onClick={() => void createTeam()}>Create and add members</Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {teams.map((team) => {
          const cohort = Array.isArray(team.ops_cohorts) ? team.ops_cohorts[0] : team.ops_cohorts;
          return (
            <Link key={team.id} href={href(`/admin/teams/${team.id}`)}>
              <Card className="h-full transition hover:ring-[#e7c15a]/40">
                <CardHeader>
                  <CardTitle>{team.name}</CardTitle>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#e7c15a]">
                    {team.status}{cohort ? ` · ${cohort.code}` : ''}{team.code ? ` · ${team.code}` : ''}
                  </p>
                </CardHeader>
                <CardContent className="text-sm text-zinc-400">
                  <p>{team.description || 'No description yet.'}</p>
                  <p className="mt-2">{team.members} members</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {teams.length === 0 ? <p className="text-sm text-zinc-400">No floor teams yet. Create Protocol, Crowd Marshal, or Registration above.</p> : null}
      </div>
    </div>
  );
}
