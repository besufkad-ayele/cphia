'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AdminStatus } from '@/app/lib/admin/status';
import type { RegistrationMetrics, RegistrationSummary } from '@/app/lib/admin/types';

type Detail = RegistrationSummary & {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name_amharic?: string;
  phone?: string;
  profession?: string;
  education_level?: string;
  residence_detail?: string;
  residence_region?: string;
  photoUrl?: string | null;
  registration_languages?: Array<{ language: string; proficiency: string }>;
  fan_number?: string | null;
  age?: number;
  nationality?: string;
  emergency_name?: string;
  emergency_phone?: string;
};

const emptyMetrics: RegistrationMetrics = { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };

const statusStyles: Record<AdminStatus, { label: string; background: string; color: string }> = {
  pending: { label: 'Pending', background: '#FFF5D9', color: '#8A6500' },
  approved: { label: 'Approved', background: '#E8F8EE', color: '#067647' },
  review: { label: 'Under review', background: '#EDEBFF', color: '#4737A8' },
  flagged: { label: 'Flagged', background: '#FDECEC', color: '#B42318' },
};

const filters: Array<{ id: 'all' | AdminStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'review', label: 'Review' },
  { id: 'flagged', label: 'Flagged' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function languageLabel(code: string) {
  if (code === 'am') return 'Amharic';
  if (code === 'om') return 'Afaan Oromo';
  if (code === 'ti') return 'Tigrigna';
  return 'English';
}

export default function AdminPage() {
  const [rows, setRows] = useState<RegistrationSummary[]>([]);
  const [metrics, setMetrics] = useState<RegistrationMetrics>(emptyMetrics);
  const [status, setStatus] = useState<'all' | AdminStatus>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (debouncedSearch) params.set('search', debouncedSearch);

    try {
      const response = await fetch(`/api/admin/registrations?${params.toString()}`);
      if (response.status === 401) {
        window.location.assign('/admin/login');
        return;
      }
      if (!response.ok) throw new Error('Could not load registrations.');
      const payload = await response.json();
      setRows(payload.registrations ?? []);
      setMetrics(payload.metrics ?? emptyMetrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load registrations.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const metricCards = useMemo(() => [
    { label: 'Total registrations', value: String(metrics.total), color: '#186059' },
    { label: 'Pending review', value: String(metrics.pending), color: '#D4AF37' },
    { label: 'Approved', value: String(metrics.approved), color: '#067647' },
    { label: 'Flagged / duplicates', value: String(metrics.flagged + metrics.review), color: '#B42318' },
  ], [metrics]);

  async function handleSignOut() {
    await fetch('/api/admin/logout', { method: 'GET' });
    window.location.assign('/admin/login');
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    const response = await fetch(`/api/admin/registrations/${id}`);
    if (response.ok) {
      setDetail(await response.json());
    }
    setDetailLoading(false);
  }

  async function approve(id: string) {
    const response = await fetch(`/api/admin/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    if (response.ok) {
      await load();
      if (detail?.id === id) await openDetail(id);
    }
  }

  function exportCsv() {
    const header = ['Registration ID', 'Name', 'Email', 'Phone', 'Sector', 'Region', 'Status', 'Submitted'];
    const body = rows.map((row) => [
      row.registrationId,
      row.name,
      row.email,
      row.phone,
      row.sector,
      row.residenceRegion,
      row.status,
      formatDate(row.createdAt),
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cphia-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>CPHIA 2026 / Admin Portal</p>
            <h1 style={titleStyle}>Volunteer operations dashboard</h1>
          </div>
          <div style={headerActionsStyle}>
            <div style={userBadgeStyle}>Super Admin</div>
            <button type="button" style={ghostButtonStyle} onClick={handleSignOut}>Sign out</button>
          </div>
        </header>

        <section style={cardsRowStyle}>
          {metricCards.map((metric) => (
            <div key={metric.label} style={metricCardStyle}>
              <div style={{ fontSize: 14, color: '#dfeef0', marginBottom: 10 }}>{metric.label}</div>
              <strong style={{ fontSize: 34, lineHeight: 1, color: metric.color }}>{metric.value}</strong>
            </div>
          ))}
        </section>

        <section style={toolbarStyle}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                style={status === item.id ? chipPrimaryStyle : chipStyle}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" style={actionButtonStyle} onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </button>
        </section>

        <section style={tableCardStyle}>
          <div className="admin-table-head">
            <div>
              <p style={tableEyebrowStyle}>Registrations</p>
              <h2 style={{ margin: '8px 0 0', fontSize: 'clamp(1.4rem, 2vw, 2rem)', color: '#102629' }}>Applicants overview</h2>
            </div>
            <div style={searchWrapStyle}>
              <span style={{ fontWeight: 700, color: '#3a4b4d' }}>Search</span>
              <input
                aria-label="Search registrations"
                placeholder="Name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={searchInputStyle}
              />
            </div>
          </div>

          {loading ? (
            <p style={stateMessageStyle}>Loading live registrations…</p>
          ) : error ? (
            <p style={stateMessageStyle}>{error}</p>
          ) : rows.length === 0 ? (
            <p style={stateMessageStyle}>No registrations match this filter yet.</p>
          ) : (
            <>
              <div className="admin-desktop-table">
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#4a6365', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      <th style={thStyle}>Applicant</th>
                      <th style={thStyle}>Sector</th>
                      <th style={thStyle}>Region</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Submitted</th>
                      <th style={thStyle}>Language</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const appearance = statusStyles[row.status];
                      return (
                        <tr key={row.id} style={{ borderTop: '1px solid #dfe9e8' }}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 800, color: '#10262a' }}>{row.name}</div>
                            <div style={{ color: '#4b6668', fontSize: 13, marginTop: 4 }}>{row.email}</div>
                            <div style={{ color: '#587072', fontSize: 12, marginTop: 4 }}>{row.registrationId}</div>
                          </td>
                          <td style={tdStyle}>{row.sector}</td>
                          <td style={tdStyle}>{row.residenceRegion}</td>
                          <td style={tdStyle}>
                            <span style={{ ...statusPillStyle, background: appearance.background, color: appearance.color }}>{appearance.label}</span>
                          </td>
                          <td style={tdStyle}>{formatDate(row.createdAt)}</td>
                          <td style={tdStyle}>{languageLabel(row.uiLanguage)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" style={primaryRowButtonStyle} onClick={() => void openDetail(row.id)}>View</button>
                              {row.status !== 'approved' ? (
                                <button type="button" style={secondaryRowButtonStyle} onClick={() => void approve(row.id)}>Approve</button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="admin-mobile-cards">
                {rows.map((row) => {
                  const appearance = statusStyles[row.status];
                  return (
                    <article key={row.id} className="admin-card">
                      <div className="admin-card-top">
                        <div>
                          <strong>{row.name}</strong>
                          <p>{row.email}</p>
                          <p>{row.registrationId}</p>
                        </div>
                        <span style={{ ...statusPillStyle, background: appearance.background, color: appearance.color }}>{appearance.label}</span>
                      </div>
                      <p>{row.sector} · {row.residenceRegion}</p>
                      <p>{formatDate(row.createdAt)} · {languageLabel(row.uiLanguage)}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button type="button" style={primaryRowButtonStyle} onClick={() => void openDetail(row.id)}>View</button>
                        {row.status !== 'approved' ? (
                          <button type="button" style={secondaryRowButtonStyle} onClick={() => void approve(row.id)}>Approve</button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {detail || detailLoading ? (
        <div className="admin-drawer-backdrop" onClick={() => setDetail(null)}>
          <aside className="admin-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="admin-drawer-head">
              <h2>Applicant detail</h2>
              <button type="button" onClick={() => setDetail(null)} style={ghostButtonStyle}>Close</button>
            </div>
            {detailLoading || !detail ? (
              <p>Loading…</p>
            ) : (
              <div className="admin-drawer-body">
                {detail.photoUrl ? <img src={detail.photoUrl} alt={detail.name} className="admin-photo" /> : null}
                <p><strong>{detail.first_name} {detail.middle_name} {detail.last_name}</strong></p>
                <p>{detail.full_name_amharic}</p>
                <p>{detail.registrationId}</p>
                <p>{detail.email}</p>
                <p>{detail.phone}</p>
                <p>{detail.sector} · {detail.residence_region || detail.residenceRegion}</p>
                <p>{detail.residence_detail}</p>
                <p>FAN: {detail.fan_number || 'Not provided'}</p>
                <p>Age {detail.age} · {detail.nationality}</p>
                <p>{detail.profession} · {detail.education_level}</p>
                <p>Emergency: {detail.emergency_name} · {detail.emergency_phone}</p>
                <p>
                  Languages:{' '}
                  {(detail.registration_languages ?? []).map((item) => `${item.language} (${item.proficiency})`).join(', ') || '—'}
                </p>
                {detail.status !== 'approved' ? (
                  <button type="button" style={primaryRowButtonStyle} onClick={() => void approve(detail.id)}>Approve applicant</button>
                ) : (
                  <p>This applicant is approved.</p>
                )}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0d3d3c 0%, #0f5d57 28%, #1b8a79 100%)',
  color: '#f5f7f8',
  padding: '24px 16px 56px',
};

const shellStyle: CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 20,
  flexWrap: 'wrap',
  marginBottom: 28,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontSize: 12,
  fontWeight: 800,
  color: '#d9f4ef',
};

const titleStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 'clamp(1.8rem, 4vw, 3rem)',
  lineHeight: 1.1,
};

const headerActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

const userBadgeStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 999,
  padding: '10px 16px',
  fontWeight: 700,
};

const ghostButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  borderRadius: 999,
  padding: '10px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const cardsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 18,
  marginBottom: 26,
};

const metricCardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 20,
  padding: '22px 20px',
  boxShadow: '0 10px 32px rgba(0,0,0,0.12)',
};

const toolbarStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 24,
  padding: 18,
  marginBottom: 28,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
};

const chipStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#edf9f6',
  borderRadius: 999,
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const chipPrimaryStyle: CSSProperties = {
  ...chipStyle,
  background: '#d4af37',
  color: '#112325',
  border: '1px solid #d4af37',
};

const actionButtonStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(17, 35, 37, 0.08)',
  color: '#123031',
  borderRadius: 999,
  padding: '9px 12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const tableCardStyle: CSSProperties = {
  background: '#f4f8f7',
  borderRadius: 24,
  padding: 18,
  boxShadow: '0 18px 40px rgba(10, 30, 28, 0.18)',
  color: '#0d1d1d',
};

const tableEyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: '#186059',
  fontWeight: 800,
};

const searchWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: '#eaf1f1',
  borderRadius: 999,
  padding: '8px 12px',
  width: 'min(100%, 320px)',
};

const searchInputStyle: CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  minWidth: 0,
  flex: 1,
  color: '#10282a',
  fontSize: 16,
};

const thStyle: CSSProperties = {
  padding: '10px 12px',
  fontWeight: 800,
  textAlign: 'left',
};

const tdStyle: CSSProperties = {
  padding: '14px 12px',
  fontSize: 14,
  color: '#1f2e2f',
  verticalAlign: 'top',
};

const statusPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 800,
};

const primaryRowButtonStyle: CSSProperties = {
  background: '#186059',
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '7px 10px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryRowButtonStyle: CSSProperties = {
  background: '#eaf1f1',
  color: '#103335',
  border: 'none',
  borderRadius: 999,
  padding: '7px 10px',
  fontWeight: 700,
  cursor: 'pointer',
};

const stateMessageStyle: CSSProperties = {
  margin: '24px 0 8px',
  color: '#315153',
  fontWeight: 700,
};
