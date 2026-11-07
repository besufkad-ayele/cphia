'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, KeyRound, Layers3, Radio, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { errorMessage } from '@/app/lib/admin/messages';
import { Banner, PageHeader } from '@/components/admin/console';
import { cn } from '@/lib/utils';

type FeedItem = {
  id: string;
  createdAt: string;
  actorName: string;
  actorEmail: string;
  action: string;
  category: string;
  module?: string;
  summary: string;
  entityType: string;
  entityId: string;
  ip: string;
};

type MonthPayload = {
  since: string;
  days: number;
  stats: {
    logins: number;
    changes: number;
    uniqueLogins: number;
    uniqueEditors: number;
  };
  logins: FeedItem[];
  loginByActor: Array<{ name: string; email: string; count: number; lastAt: string }>;
  changes: FeedItem[];
  byModule: Array<{
    module: string;
    label: string;
    count: number;
    actors: Array<{ name: string; email: string; count: number; lastAt: string }>;
  }>;
  byActorModules: Array<{
    name: string;
    email: string;
    total: number;
    modules: Array<{ module: string; count: number }>;
  }>;
  byDay: Array<{ day: string; logins: number; changes: number }>;
};

type PulsePayload = {
  generatedAt: string;
  pollMs: number;
  feed: FeedItem[];
  stats: {
    lastHour: number;
    last24h: number;
    last7d: number;
    uniqueActorsToday: number;
    activeAdmins: number;
    registrationsToday: number;
    registrations: { total: number; pending: number; approved: number; review: number; flagged: number };
    attendanceToday: { present: number; late: number; absent: number; excused: number; total: number };
  };
  charts: {
    byHour: Array<{ hour: string; count: number }>;
    byAction: Array<{ action: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    byActor: Array<{ name: string; email: string; count: number }>;
    bySector: Array<{ sector: string; count: number }>;
  };
  month: MonthPayload;
};

const CATEGORY_TONE: Record<string, string> = {
  auth: 'text-sky-300 bg-sky-400/10 border-sky-400/30',
  volunteer: 'text-[#e7c15a] bg-[#e7c15a]/10 border-[#e7c15a]/30',
  attendance: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
  shift: 'text-violet-300 bg-violet-400/10 border-violet-400/30',
  cohort: 'text-orange-300 bg-orange-400/10 border-orange-400/30',
  form: 'text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/30',
  user: 'text-rose-300 bg-rose-400/10 border-rose-400/30',
  role: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/30',
  export: 'text-amber-200 bg-amber-400/10 border-amber-400/30',
  registration: 'text-lime-300 bg-lime-400/10 border-lime-400/30',
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDay(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatHourLabel(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit' });
  } catch {
    return iso.slice(11, 13);
  }
}

function BarList({
  rows,
  labelKey,
  valueKey,
}: {
  rows: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  if (!rows.length) {
    return <p className="text-sm text-zinc-500">No activity in this window yet.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        const label = String(row[labelKey] ?? '');
        return (
          <li key={label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-zinc-300">{label}</span>
              <span className="tabular-nums text-zinc-400">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[#e7c15a]" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            CATEGORY_TONE[item.category] || 'border-white/15 bg-white/5 text-zinc-300',
          )}
        >
          {item.module || item.category}
        </span>
        <span className="text-[11px] text-zinc-500">{formatTime(item.createdAt)}</span>
        <span className="text-[11px] text-zinc-600">{item.action}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-100">{item.summary}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {item.actorName}
        {item.actorEmail ? ` · ${item.actorEmail}` : ''}
        {item.entityType ? ` · ${item.entityType}` : ''}
        {item.entityId ? ` ${item.entityId.slice(0, 12)}` : ''}
        {item.ip ? ` · ${item.ip}` : ''}
      </p>
    </article>
  );
}

export default function OpsPulsePage() {
  const [data, setData] = useState<PulsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [monthTab, setMonthTab] = useState<'logins' | 'modules' | 'people'>('logins');
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (inFlight.current) return;
      inFlight.current = true;
      setFetching(true);
      try {
        const response = await fetch('/api/admin/activity?limit=100');
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.status === 403) {
          setForbidden(true);
          setError('This pulse board is limited to super admins.');
          return;
        }
        if (!response.ok) {
          setError(errorMessage(payload, 'Could not load activity.'));
          return;
        }
        setError(null);
        setForbidden(false);
        setData(payload as PulsePayload);
        setTick((n) => n + 1);
      } catch {
        if (!cancelled) setError('Could not load activity.');
      } finally {
        inFlight.current = false;
        if (!cancelled) setFetching(false);
      }
    }

    void load();
    if (!live) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      void load();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [live]);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-rose-400/30 bg-rose-500/10 p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-rose-300" />
        <h1 className="mt-4 text-xl font-semibold text-white">Restricted</h1>
        <p className="mt-2 text-sm text-zinc-400">Only a super admin can open the ops pulse board.</p>
      </div>
    );
  }

  const stats = data?.stats;
  const charts = data?.charts;
  const month = data?.month;
  const maxHour = Math.max(1, ...(charts?.byHour.map((row) => row.count) ?? [1]));
  const maxDay = Math.max(1, ...(month?.byDay.map((row) => row.logins + row.changes) ?? [1]));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="PRIVATE"
        title="Ops pulse"
        description="Live desk feed plus a 30-day login and module-change audit. Not linked in the sidebar."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
              live ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-white/5 text-zinc-400',
            )}
          >
            <Radio className={cn('size-3.5', live && 'animate-pulse')} />
            {live ? 'Live · 2s' : 'Paused'}
          </span>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10"
            onClick={() => setLive((value) => !value)}
          >
            {live ? 'Pause' : 'Resume'}
          </button>
          <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <RefreshCw className={cn('size-3.5', fetching && 'animate-spin')} />
            {data?.generatedAt ? formatTime(data.generatedAt) : '—'} · #{tick}
          </span>
        </div>
      </PageHeader>

      <Banner message={error} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Dashboard logins · 30d', value: month?.stats.logins ?? '—', note: `${month?.stats.uniqueLogins ?? 0} people signed in` },
          { label: 'Module changes · 30d', value: month?.stats.changes ?? '—', note: `${month?.stats.uniqueEditors ?? 0} people edited modules` },
          { label: 'Events · last hour', value: stats?.lastHour ?? '—', note: `${stats?.last24h ?? 0} in 24h · ${stats?.last7d ?? 0} in 7d` },
          { label: 'Attendance today', value: stats?.attendanceToday.total ?? '—', note: `${stats?.attendanceToday.present ?? 0} present · ${stats?.registrationsToday ?? 0} new regs` },
        ].map((card) => (
          <div key={card.label} className="rounded-3xl border border-white/10 bg-black/35 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{card.value}</p>
            <p className="mt-1 text-xs text-zinc-400">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e7c15a]">LAST 30 DAYS</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Who signed in, and who changed what</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Full-month audit of dashboard logins and every module mutation, grouped by person.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'logins' as const, label: 'Logins', icon: KeyRound },
              { id: 'modules' as const, label: 'By module', icon: Layers3 },
              { id: 'people' as const, label: 'By person', icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMonthTab(tab.id)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition',
                  monthTab === tab.id
                    ? 'border-[#e7c15a]/50 bg-[#e7c15a]/15 text-[#f6e7b2]'
                    : 'border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10',
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex h-24 items-end gap-1">
          {(month?.byDay ?? []).map((row) => {
            const total = row.logins + row.changes;
            return (
              <div key={row.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={`${row.day}: ${row.logins} logins, ${row.changes} changes`}>
                <div className="flex w-full flex-col justify-end" style={{ height: `${Math.max(total ? 8 : 3, (total / maxDay) * 100)}%` }}>
                  <div className="w-full bg-sky-400/80" style={{ height: `${total ? (row.logins / total) * 100 : 0}%` }} />
                  <div className="w-full bg-[#e7c15a]/85" style={{ height: `${total ? (row.changes / total) * 100 : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
          <span>{month?.byDay?.[0] ? formatDay(month.byDay[0].day) : ''}</span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-sky-400/80" /> Logins</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-[#e7c15a]/85" /> Module changes</span>
          </span>
          <span>today</span>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          {monthTab === 'logins' ? (
            <>
              <div>
                <h3 className="mb-3 text-sm font-medium text-white">All dashboard logins</h3>
                <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                  {(month?.logins ?? []).length === 0 ? (
                    <p className="text-sm text-zinc-500">No logins recorded in the last 30 days yet.</p>
                  ) : (
                    month?.logins.map((item) => <FeedCard key={item.id} item={item} />)
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <h3 className="mb-3 text-sm font-medium text-white">Who signed in most</h3>
                <ul className="space-y-3">
                  {(month?.loginByActor ?? []).length === 0 ? (
                    <li className="text-sm text-zinc-500">No login actors yet.</li>
                  ) : (
                    month?.loginByActor.map((person) => (
                      <li key={`${person.email}-${person.name}`} className="border-b border-white/6 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">{person.name}</p>
                            <p className="truncate text-xs text-zinc-500">{person.email || 'No email'}</p>
                          </div>
                          <div className="text-right">
                            <p className="tabular-nums text-sm text-[#e7c15a]">{person.count}</p>
                            <p className="text-[11px] text-zinc-500">last {formatTime(person.lastAt)}</p>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          ) : null}

          {monthTab === 'modules' ? (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Modules altered · who touched them</h3>
                {(month?.byModule ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-500">No module edits in the last 30 days yet.</p>
                ) : (
                  month?.byModule.map((module) => (
                    <div key={module.module} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{module.label}</p>
                          <p className="text-xs text-zinc-500">{module.count} change{module.count === 1 ? '' : 's'}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                            CATEGORY_TONE[module.module] || 'border-white/15 bg-white/5 text-zinc-300',
                          )}
                        >
                          {module.module}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {module.actors.map((actor) => (
                          <li key={`${module.module}-${actor.email}-${actor.name}`} className="flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-zinc-300">
                              {actor.name}
                              {actor.email ? ` · ${actor.email}` : ''}
                            </span>
                            <span className="shrink-0 tabular-nums text-zinc-400">
                              {actor.count} · {formatTime(actor.lastAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-white">Recent module changes</h3>
                <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
                  {(month?.changes ?? []).length === 0 ? (
                    <p className="text-sm text-zinc-500">No module changes logged yet.</p>
                  ) : (
                    month?.changes.map((item) => <FeedCard key={item.id} item={item} />)
                  )}
                </div>
              </div>
            </>
          ) : null}

          {monthTab === 'people' ? (
            <div className="xl:col-span-2">
              <h3 className="mb-3 text-sm font-medium text-white">Each person → modules they altered</h3>
              {(month?.byActorModules ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">No editors in the last 30 days yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {month?.byActorModules.map((person) => (
                    <div key={`${person.email}-${person.name}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{person.name}</p>
                          <p className="truncate text-xs text-zinc-500">{person.email || 'No email'}</p>
                        </div>
                        <p className="tabular-nums text-sm text-[#e7c15a]">{person.total}</p>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {person.modules.map((module) => (
                          <li key={`${person.email}-${module.module}`} className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                            <span>{module.module}</span>
                            <span className="tabular-nums text-zinc-500">{module.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e7c15a]">LIVE FEED</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Everything that just happened</h2>
            </div>
            <Activity className="size-5 text-zinc-500" />
          </div>
          <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
            {(data?.feed ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No logged actions yet. Desk activity will appear here as it happens.</p>
            ) : (
              data?.feed.map((item) => <FeedCard key={item.id} item={item} />)
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e7c15a]">LAST 24 HOURS</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Events by hour</h2>
            <div className="mt-4 flex h-28 items-end gap-1">
              {(charts?.byHour ?? []).map((row) => (
                <div key={row.hour} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t-sm bg-[#e7c15a]/85"
                    style={{ height: `${Math.max(4, (row.count / maxHour) * 100)}%` }}
                    title={`${formatHourLabel(row.hour)}: ${row.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
              <span>{charts?.byHour?.[0] ? formatHourLabel(charts.byHour[0].hour) : ''}</span>
              <span>now</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e7c15a]">BY CATEGORY · 24H</p>
            <div className="mt-4">
              <BarList rows={(charts?.byCategory ?? []) as Array<Record<string, string | number>>} labelKey="category" valueKey="count" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-4 text-[#e7c15a]" />
            <h2 className="text-base font-semibold text-white">Top actors · 24h</h2>
          </div>
          <BarList
            rows={(charts?.byActor ?? []).map((row) => ({ name: row.name || row.email || 'Unknown', count: row.count }))}
            labelKey="name"
            valueKey="count"
          />
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
          <h2 className="mb-4 text-base font-semibold text-white">Top actions · 24h</h2>
          <BarList rows={(charts?.byAction ?? []) as Array<Record<string, string | number>>} labelKey="action" valueKey="count" />
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/35 p-4 md:p-5">
          <h2 className="mb-4 text-base font-semibold text-white">Volunteer pipeline</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Total', stats?.registrations.total],
              ['Pending', stats?.registrations.pending],
              ['In review', stats?.registrations.review],
              ['Approved', stats?.registrations.approved],
              ['Flagged', stats?.registrations.flagged],
              ['Active admins', stats?.activeAdmins],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-white/6 py-1.5 last:border-0">
                <dt className="text-zinc-400">{label}</dt>
                <dd className="tabular-nums text-white">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5">
            <p className="mb-3 text-xs uppercase tracking-[0.14em] text-zinc-500">By sector</p>
            <BarList rows={(charts?.bySector ?? []) as Array<Record<string, string | number>>} labelKey="sector" valueKey="count" />
          </div>
        </div>
      </section>
    </div>
  );
}
