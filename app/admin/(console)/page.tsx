'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CalendarRange, ClipboardList, Clock3, Users } from 'lucide-react';
import type { RegistrationMetrics, RegistrationSummary } from '@/app/lib/admin/types';
import { adminFetch } from '@/app/lib/admin/messages';
import { hasFeature } from '@/app/lib/admin/permissions';
import { StatusBadge } from '@/components/admin/status-badge';
import { Banner, PageHeader } from '@/components/admin/console';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { href } from '@/lib/app-href';

const emptyMetrics: RegistrationMetrics = { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };

type BoardShift = {
  id: string;
  name: string;
  location: string;
  start: string;
  end: string;
  capacity: number;
  present: number;
  cohort: string;
};

type Overview = {
  metrics: RegistrationMetrics;
  recent: RegistrationSummary[];
  cohorts: number;
  shiftsToday: number;
  checkedInToday: number;
  formsPublished: number;
  team: number;
  todayBoard: BoardShift[];
  migrationRequired: boolean;
  permissions: string[];
  role: string;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = new Date().toLocaleDateString('en-CA');
    adminFetch<Overview>(`/api/admin/overview?date=${date}`)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics ?? emptyMetrics;
  const session = { role: data?.role || 'admin', permissions: data?.permissions ?? [] };
  const cards = [
    { label: 'Volunteers', value: metrics.total, note: `${metrics.pending} pending · ${metrics.approved} approved`, href: '/admin/volunteers', icon: Users, feature: 'volunteers' as const },
    { label: 'On duty today', value: data?.shiftsToday ?? 0, note: `${data?.checkedInToday ?? 0} checked in`, href: '/admin/attendance', icon: CalendarCheck, feature: 'attendance' as const },
    { label: 'Open cohorts', value: data?.cohorts ?? 0, note: 'Planning, live, and active events', href: '/admin/cohorts', icon: CalendarRange, feature: 'cohorts' as const },
    { label: 'Live forms', value: data?.formsPublished ?? 0, note: 'Published briefings and checklists', href: '/admin/forms', icon: ClipboardList, feature: 'forms' as const },
    { label: 'Shifts', value: data?.shiftsToday ?? 0, note: 'Roster blocks scheduled today', href: '/admin/shifts', icon: Clock3, feature: 'shifts' as const },
  ].filter((card) => !data || hasFeature(session, card.feature));

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="CPHIA-26 COHORT"
        title="Desk at a glance"
        description="Registrations, today’s roster, and the modules this role can open."
      />
      <Banner message={error || (data?.migrationRequired ? 'Apply supabase/migrations/009_ops_modules.sql to turn on attendance, shifts, cohorts, forms, and roles.' : null)} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}><CardHeader><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></CardHeader></Card>
            ))
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={href(card.href)}>
                  <Card className="h-full transition hover:ring-[#e7c15a]/40">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-2"><Icon className="size-4 text-[#e7c15a]" />{card.label}</CardDescription>
                      <CardTitle className="text-3xl text-white">{card.value}</CardTitle>
                      <p className="text-xs text-zinc-400">{card.note}</p>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today’s floor</CardTitle>
            <CardDescription>Shifts scheduled for today and how many people are marked in.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {loading ? <Skeleton className="h-16 w-full" /> : null}
            {(data?.todayBoard ?? []).map((shift) => (
              <Link key={shift.id} href={href('/admin/attendance')} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm hover:bg-white/5">
                <div>
                  <p className="font-medium text-white">{shift.name}</p>
                  <p className="text-xs text-zinc-400">{shift.cohort} · {shift.start}–{shift.end} · {shift.location}</p>
                </div>
                <p className="text-right text-sm text-[#f6e7b2]">{shift.present}{shift.capacity ? ` / ${shift.capacity}` : ''}</p>
              </Link>
            ))}
            {!loading && (data?.todayBoard.length ?? 0) === 0 ? (
              <p className="text-sm text-zinc-400">No shifts on today’s date yet. Add one from Shifts.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent registrations</CardTitle>
              <CardDescription>{metrics.review + metrics.flagged} still need a review look.</CardDescription>
            </div>
            <Link href={href('/admin/volunteers')} className="text-sm text-[#e7c15a]">View all</Link>
          </CardHeader>
          <CardContent className="grid gap-2">
            {loading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />) : null}
            {(data?.recent ?? []).map((row) => (
              <Link key={row.id} href={href(`/admin/volunteers/${row.id}`)} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{row.name}</p>
                  <p className="truncate text-xs text-zinc-400">{row.registrationId} · {row.sector}</p>
                </div>
                <StatusBadge status={row.status} />
              </Link>
            ))}
            {!loading && (data?.recent.length ?? 0) === 0 ? <p className="text-sm text-zinc-400">No recent volunteers for this role.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
