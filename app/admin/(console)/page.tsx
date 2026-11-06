'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';
import type { RegistrationMetrics, RegistrationSummary } from '@/app/lib/admin/types';
import { StatusBadge } from '@/components/admin/status-badge';
import { href } from '@/lib/app-href';
import { cn } from '@/lib/utils';

const emptyMetrics: RegistrationMetrics = { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<RegistrationMetrics>(emptyMetrics);
  const [recent, setRecent] = useState<RegistrationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/registrations?page=1&pageSize=8')
      .then((response) => response.json())
      .then((payload) => {
        setMetrics(payload.metrics ?? emptyMetrics);
        setRecent(payload.registrations ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total volunteers', value: metrics.total, href: '/admin/volunteers' },
    { label: 'Pending', value: metrics.pending, href: '/admin/volunteers?status=pending' },
    { label: 'Approved', value: metrics.approved, href: '/admin/volunteers?status=approved' },
    { label: 'Review / flagged', value: metrics.review + metrics.flagged, href: '/admin/volunteers?status=review' },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">CPHIA-26 COHORT</p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Facility volunteer registrations for CPHIA 2026.</p>
        </div>
        <Link href={href('/admin/volunteers')} className={cn(buttonVariants(), 'h-11')}>Open volunteers</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </CardHeader>
              </Card>
            ))
          : cards.map((card) => (
              <Link key={card.label} href={href(card.href)}>
                <Card className="transition hover:ring-foreground/20">
                  <CardHeader>
                    <CardDescription>{card.label}</CardDescription>
                    <CardTitle className="text-3xl">{card.value}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent registrations</CardTitle>
            <CardDescription>Latest volunteers in the CPHIA-26 cohort.</CardDescription>
          </div>
          <Link href={href('/admin/volunteers')} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>View all</Link>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)
            : recent.map((row) => (
                <Link
                  key={row.id}
                  href={href(`/admin/volunteers/${row.id}`)}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.registrationId} · {row.sector}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </Link>
              ))}
          {!loading && recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No volunteers yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
