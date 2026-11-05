import type { CSSProperties } from 'react';

type Status = 'pending' | 'approved' | 'review' | 'flagged';

type RegistrationRow = {
  id: string;
  name: string;
  email: string;
  sector: string;
  region: string;
  status: Status;
  submitted: string;
  language: string;
  score: number;
};

const metrics = [
  { label: 'Total registrations', value: '1,284', change: '+12.4% vs last week', color: '#186059' },
  { label: 'Pending review', value: '73', change: '18 urgent items', color: '#D4AF37' },
  { label: 'Approved', value: '1,021', change: '79.5% clearance rate', color: '#067647' },
  { label: 'Flagged duplicates', value: '14', change: '3 new today', color: '#B42318' },
];

const rows: RegistrationRow[] = [
  { id: 'CPHIA-26-000124', name: 'Selam Bekele', email: 'selam.bekele@gmail.com', sector: 'Health', region: 'Addis Ababa', status: 'approved', submitted: '2026-11-05', language: 'English', score: 96 },
  { id: 'CPHIA-26-000119', name: 'Abel Tadesse', email: 'abel.tadesse@gmail.com', sector: 'Logistics', region: 'Oromia', status: 'pending', submitted: '2026-11-04', language: 'Amharic', score: 88 },
  { id: 'CPHIA-26-000117', name: 'Netsanet Alemu', email: 'netsanet.alemu@gmail.com', sector: 'Communications', region: 'Tigray', status: 'review', submitted: '2026-11-04', language: 'English', score: 74 },
  { id: 'CPHIA-26-000111', name: 'Mekdes Girma', email: 'mekdes.g@gmail.com', sector: 'Health', region: 'SNNPR', status: 'flagged', submitted: '2026-11-03', language: 'English', score: 62 },
  { id: 'CPHIA-26-000109', name: 'Daniel Bekele', email: 'daniel@gmail.com', sector: 'Protocol', region: 'Addis Ababa', status: 'approved', submitted: '2026-11-03', language: 'Amharic', score: 91 },
  { id: 'CPHIA-26-000101', name: 'Tinsae Hailu', email: 'tinsae.h@gmail.com', sector: 'Media', region: 'Amhara', status: 'pending', submitted: '2026-11-02', language: 'English', score: 83 },
];

const statusStyles: Record<Status, { label: string; background: string; color: string }> = {
  pending: { label: 'Pending', background: '#FFF5D9', color: '#8A6500' },
  approved: { label: 'Approved', background: '#E8F8EE', color: '#067647' },
  review: { label: 'Under review', background: '#EDEBFF', color: '#4737A8' },
  flagged: { label: 'Flagged', background: '#FDECEC', color: '#B42318' },
};

export default function AdminPage() {
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
            <button type="button" style={ghostButtonStyle}>Sign out</button>
          </div>
        </header>

        <section style={cardsRowStyle}>
          {metrics.map((metric) => (
            <div key={metric.label} style={metricCardStyle}>
              <div style={{ fontSize: 14, color: '#dfeef0', marginBottom: 10 }}>{metric.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <strong style={{ fontSize: 34, lineHeight: 1, color: metric.color }}>{metric.value}</strong>
                <span style={{ fontSize: 12, color: '#effcf8' }}>{metric.change}</span>
              </div>
            </div>
          ))}
        </section>

        <section style={toolbarStyle}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" style={chipPrimaryStyle}>All</button>
            <button type="button" style={chipStyle}>Pending</button>
            <button type="button" style={chipStyle}>Approved</button>
            <button type="button" style={chipStyle}>Review</button>
            <button type="button" style={chipStyle}>Flagged</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" style={actionButtonStyle}>Export CSV</button>
            <button type="button" style={actionButtonStyle}>Review duplicate</button>
            <button type="button" style={actionButtonStyle}>Approve batch</button>
          </div>
        </section>

        <section style={tableCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <p style={tableEyebrowStyle}>Registrations</p>
              <h2 style={{ margin: '8px 0 0', fontSize: 'clamp(1.5rem, 2vw, 2rem)', color: '#102629' }}>Applicants overview</h2>
            </div>
            <div style={searchWrapStyle}>
              <span style={{ fontWeight: 700, color: '#3a4b4d' }}>Search</span>
              <input
                aria-label="Search registrations"
                placeholder="Applicant or email"
                style={searchInputStyle}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#4a6365', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  <th style={thStyle}>Applicant</th>
                  <th style={thStyle}>Sector</th>
                  <th style={thStyle}>Region</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={thStyle}>Language</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = statusStyles[row.status];
                  return (
                    <tr key={row.id} style={{ borderTop: '1px solid #dfe9e8' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800, color: '#10262a' }}>{row.name}</div>
                        <div style={{ color: '#4b6668', fontSize: 13, marginTop: 4 }}>{row.email}</div>
                        <div style={{ color: '#587072', fontSize: 12, marginTop: 4 }}>{row.id}</div>
                      </td>
                      <td style={tdStyle}>{row.sector}</td>
                      <td style={tdStyle}>{row.region}</td>
                      <td style={tdStyle}>
                        <span style={{ ...statusPillStyle, background: status.background, color: status.color }}>{status.label}</span>
                      </td>
                      <td style={tdStyle}>{row.submitted}</td>
                      <td style={tdStyle}>{row.language}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800 }}>{row.score}</span>
                          <div style={{ width: 76, height: 8, borderRadius: 999, background: '#dbe6e5', overflow: 'hidden' }}>
                            <div style={{ width: `${row.score}%`, height: '100%', background: 'linear-gradient(90deg, #186059, #2DAE95)' }} />
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={primaryRowButtonStyle}>View</button>
                          <button type="button" style={secondaryRowButtonStyle}>Approve</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0d3d3c 0%, #0f5d57 28%, #1b8a79 100%)',
  color: '#f5f7f8',
  padding: '32px 20px 56px',
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
  fontSize: 'clamp(2rem, 3vw, 3rem)',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
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
  padding: 22,
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
  padding: 22,
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
};

const searchInputStyle: CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  minWidth: 200,
  color: '#10282a',
  fontSize: 14,
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
