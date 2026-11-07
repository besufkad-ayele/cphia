'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { adminFetch } from '@/app/lib/admin/messages';
import { formatVolunteerName } from '@/app/lib/admin/types';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

type Admin = { id: string; full_name: string | null; email: string; role_key?: string | null };
type Person = {
  id: string;
  registration_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  sector: string;
  email: string;
  phone?: string;
};
type Member = { id: string; role: string; registrationId: string; person: Person | null };
type Shift = { id: string; name: string; shift_date: string; start_time: string; end_time: string; kind: string; sheet_status: string };
type Detail = {
  team: {
    id: string;
    cohort_id: string;
    name: string;
    code: string;
    description: string;
    supervisor_admin_id: string | null;
    status: string;
    ops_cohorts: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
  };
  members: Member[];
  admins: Admin[];
  shifts: Shift[];
};

function one<T>(value: T | T[] | null) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('');
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);

  async function load() {
    setDetail(await adminFetch<Detail>(`/api/admin/teams/${params.id}`));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, [params.id]);

  useEffect(() => {
    if (!detail) return;
    const handle = window.setTimeout(() => {
      setSearching(true);
      const search = new URLSearchParams({
        mode: 'candidates',
        cohortId: detail.team.cohort_id,
      });
      if (query.trim()) search.set('q', query.trim());
      if (sector.trim()) search.set('sector', sector.trim());
      adminFetch<{ candidates: Person[] }>(`/api/admin/teams?${search}`)
        .then((payload) => setCandidates(payload.candidates ?? []))
        .catch((reason: Error) => setError(reason.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [detail, query, sector]);

  const memberIds = useMemo(() => new Set((detail?.members ?? []).map((row) => row.registrationId)), [detail]);
  const visibleCandidates = candidates.filter((person) => !memberIds.has(person.id));

  function patchTeam(partial: Partial<Detail['team']>) {
    setDetail((current) => (current ? { ...current, team: { ...current.team, ...partial } } : current));
  }

  async function saveTeam() {
    if (!detail) return;
    try {
      await adminFetch(`/api/admin/teams/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          cohortId: detail.team.cohort_id,
          name: detail.team.name,
          code: detail.team.code,
          description: detail.team.description,
          supervisorAdminId: detail.team.supervisor_admin_id,
          status: detail.team.status,
        }),
      });
      toast.success('Team saved.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the team.');
    }
  }

  async function removeTeam() {
    if (!window.confirm('Delete this team and its memberships?')) return;
    try {
      await adminFetch(`/api/admin/teams/${params.id}`, { method: 'DELETE' });
      router.push(href('/admin/teams'));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the team.');
    }
  }

  async function addSelected(role: 'member' | 'zone_captain' = 'member') {
    const registrationIds = [...selected];
    if (!registrationIds.length) return;
    try {
      await adminFetch(`/api/admin/teams/${params.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ registrationIds, role }),
      });
      toast.success(`Added ${registrationIds.length} volunteer(s).`);
      setSelected(new Set());
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not add members.');
    }
  }

  async function setRole(memberId: string, role: string) {
    try {
      await adminFetch(`/api/admin/teams/${params.id}/members`, {
        method: 'PATCH',
        body: JSON.stringify({ memberId, role }),
      });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update role.');
    }
  }

  async function removeMember(memberId: string) {
    try {
      await adminFetch(`/api/admin/teams/${params.id}/members?memberId=${memberId}`, { method: 'DELETE' });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not remove member.');
    }
  }

  const team = detail?.team;
  const cohort = team ? one(team.ops_cohorts) : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="TEAM"
        title={team?.name || 'Team'}
        description={
          cohort
            ? `${cohort.code} · assign a Floor supervisor (desk login), then promote zone captains on the roster (info only — no login).`
            : 'Floor team detail'
        }
      >
        <Link href={href('/admin/shifts')} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>Create ops shift</Link>
      </PageHeader>
      <Banner message={error} />
      {team ? (
        <>
          <Card>
            <CardHeader><CardTitle>Team record</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Name"><input className={controlClass} value={team.name} onChange={(event) => patchTeam({ name: event.target.value })} /></Field>
              <Field label="Code"><input className={controlClass} value={team.code} onChange={(event) => patchTeam({ code: event.target.value })} /></Field>
              <Field label="Supervisor (desk login)">
                <select
                  className={controlClass}
                  value={team.supervisor_admin_id || ''}
                  onChange={(event) => patchTeam({ supervisor_admin_id: event.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {(detail?.admins ?? [])
                    .slice()
                    .sort((a, b) => Number(b.role_key === 'supervisor') - Number(a.role_key === 'supervisor'))
                    .map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.full_name || admin.email}
                        {admin.role_key === 'supervisor' ? ' · supervisor' : ''}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Status">
                <select className={controlClass} value={team.status} onChange={(event) => patchTeam({ status: event.target.value })}>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Detail"><textarea className={`${controlClass} min-h-24 py-3`} value={team.description} onChange={(event) => patchTeam({ description: event.target.value })} /></Field>
              </div>
              <div className="flex gap-2">
                <Button className="h-11" onClick={() => void saveTeam()}>Save team</Button>
                <Button variant="ghost" className="h-11" onClick={() => void removeTeam()}>Delete</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Add volunteers</CardTitle>
                <p className="text-sm text-zinc-400">Search by name, ID, phone. Filter by sector.</p>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={controlClass} value={query} placeholder="Search approved volunteers" onChange={(event) => setQuery(event.target.value)} />
                  <input className={controlClass} value={sector} placeholder="Sector filter" onChange={(event) => setSector(event.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={!selected.size} onClick={() => void addSelected('member')}>Add as members ({selected.size})</Button>
                  <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void addSelected('zone_captain')}>Add as zone captains</Button>
                </div>
                <div className="grid max-h-[420px] gap-2 overflow-y-auto">
                  {visibleCandidates.map((person) => {
                    const checked = selected.has(person.id);
                    return (
                      <label key={person.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => {
                            setSelected((current) => {
                              const next = new Set(current);
                              if (next.has(person.id)) next.delete(person.id);
                              else next.add(person.id);
                              return next;
                            });
                          }}
                        />
                        <span>
                          <span className="block text-sm font-medium text-white">{formatVolunteerName(person)}</span>
                          <span className="block text-xs text-zinc-400">{person.registration_id} · {person.sector}{person.phone ? ` · ${person.phone}` : ''}</span>
                        </span>
                      </label>
                    );
                  })}
                  {searching ? <p className="text-sm text-zinc-400">Searching…</p> : null}
                  {!searching && visibleCandidates.length === 0 ? <p className="text-sm text-zinc-400">No matching approved volunteers left to add.</p> : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Roster · {detail?.members.length ?? 0}</CardTitle>
                <p className="text-sm text-zinc-400">Zone captain is a roster label only — no desk password. Supervisors mark attendance with their own login.</p>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(detail?.members ?? []).map((member) => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{member.person ? formatVolunteerName(member.person) : 'Volunteer'}</p>
                      <p className="text-xs text-zinc-400">{member.person?.registration_id} · {member.person?.sector}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select className={`${controlClass} h-9 w-auto`} value={member.role} onChange={(event) => void setRole(member.id, event.target.value)}>
                        <option value="member">member</option>
                        <option value="zone_captain">zone captain (info)</option>
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => void removeMember(member.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
                {(detail?.members.length ?? 0) === 0 ? <p className="text-sm text-zinc-400">No members yet. Search on the left and add them.</p> : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Ops shifts for this team</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {(detail?.shifts ?? []).map((shift) => (
                <div key={shift.id} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm">
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-zinc-400">{shift.shift_date} · {String(shift.start_time).slice(0, 5)}–{String(shift.end_time).slice(0, 5)} · {shift.kind} · sheet {shift.sheet_status}</p>
                </div>
              ))}
              {(detail?.shifts.length ?? 0) === 0 ? <p className="text-sm text-zinc-400">No ops shifts yet. Create one under Shifts and attach this team.</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
