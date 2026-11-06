'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DemographicsSummary } from '@/app/lib/admin/demographics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const MALE = '#5b9fd4';
const FEMALE = '#e7c15a';
const UNSPECIFIED = '#71717a';
const GRID = 'rgba(255,255,255,0.08)';
const TICK = '#a1a1aa';

const genderColors: Record<string, string> = {
  Male: MALE,
  Female: FEMALE,
  Unspecified: UNSPECIFIED,
};

const tooltipStyle = {
  backgroundColor: '#111113',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  color: '#fafafa',
};

function EmptyNote({ children }: { children: string }) {
  return <p className="py-8 text-center text-sm text-zinc-400">{children}</p>;
}

function CountTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-white/10">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${index}-${cellIndex}`}
                  className={`px-3 py-2 ${cellIndex === 0 ? 'text-white' : 'text-[#f6e7b2]'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardDemographics({
  data,
  loading,
  total,
}: {
  data: DemographicsSummary | null;
  loading: boolean;
  total: number;
}) {
  const gender = data?.gender ?? [];
  const genderBySector = data?.genderBySector ?? [];
  const ageBuckets = data?.age.buckets ?? [];
  const education = data?.education ?? [];
  const hasGender = gender.some((row) => row.count > 0);
  const hasAge = (data?.age.withAge ?? 0) > 0;
  const hasEducation = education.some((row) => row.count > 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gender comparison</CardTitle>
            <CardDescription>All registrations in the current filter.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loading ? <Skeleton className="h-56 w-full" /> : null}
            {!loading && !hasGender ? <EmptyNote>No gender data yet.</EmptyNote> : null}
            {!loading && hasGender ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gender}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {gender.map((entry) => (
                          <Cell key={entry.name} fill={genderColors[entry.name] ?? UNSPECIFIED} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => {
                          const count = typeof value === 'number' ? value : Number(value ?? 0);
                          const pct = total ? Math.round((count / total) * 1000) / 10 : 0;
                          return [`${count} (${pct}%)`, String(name)];
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <CountTable
                  headers={['Gender', 'Count', '%']}
                  rows={gender.map((row) => [row.name, row.count, `${row.percent}%`])}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gender by sector</CardTitle>
            <CardDescription>Male vs female counts across sectors.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loading ? <Skeleton className="h-56 w-full" /> : null}
            {!loading && genderBySector.length === 0 ? (
              <EmptyNote>No sector gender data yet.</EmptyNote>
            ) : null}
            {!loading && genderBySector.length > 0 ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={genderBySector} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="sector" tick={{ fill: TICK, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fill: TICK, fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="Male" stackId="g" fill={MALE} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Female" stackId="g" fill={FEMALE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <CountTable
                  headers={['Sector', 'Male', 'Female', 'Total']}
                  rows={genderBySector.map((row) => [row.sector, row.Male, row.Female, row.total])}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Age comparison</CardTitle>
            <CardDescription>
              {data?.age.mean != null
                ? `Mean ${data.age.mean} · median ${data.age.median} · ${data.age.withAge} with age`
                : 'Age buckets for all registrations.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loading ? <Skeleton className="h-56 w-full" /> : null}
            {!loading && !hasAge ? <EmptyNote>No age data yet.</EmptyNote> : null}
            {!loading && hasAge ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageBuckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: TICK, fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="Male" stackId="a" fill={MALE} />
                      <Bar dataKey="Female" stackId="a" fill={FEMALE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <CountTable
                  headers={['Age', 'Male', 'Female', 'Total']}
                  rows={ageBuckets.map((row) => [row.label, row.Male, row.Female, row.count])}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Education comparison</CardTitle>
            <CardDescription>Education level mix, split by gender.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {loading ? <Skeleton className="h-56 w-full" /> : null}
            {!loading && !hasEducation ? <EmptyNote>No education data yet.</EmptyNote> : null}
            {!loading && hasEducation ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={education}
                      layout="vertical"
                      margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: TICK, fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={88}
                        tick={{ fill: TICK, fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="Male" stackId="e" fill={MALE} />
                      <Bar dataKey="Female" stackId="e" fill={FEMALE} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <CountTable
                  headers={['Education', 'Male', 'Female', 'Total', '%']}
                  rows={education.map((row) => [
                    row.name,
                    row.Male,
                    row.Female,
                    row.count,
                    `${row.percent}%`,
                  ])}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
