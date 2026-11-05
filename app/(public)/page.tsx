const highlights = [
  'November 23–27, 2026',
  'Addis International Convention Center',
  'Addis Ababa, Ethiopia',
];

const reasons = [
  { title: 'Network with Global Leaders', text: 'Connect directly with public health pioneers, policymakers, and international delegates.' },
  { title: 'Gain Inside Access', text: 'Experience high-level plenary sessions, technical panels, and health innovation exhibitions.' },
  { title: 'Official Recognition', text: 'Receive an official CPHIA 2026 Certificate of Service and conference-branded attire.' },
  { title: 'Build Your Career', text: 'Develop hands-on experience in international conference logistics and global health communication.' },
];

const roles = [
  'Delegate Registration & Accreditation',
  'Session & Hall Management',
  'Protocol & VIP Liaison',
  'Media & Digital Communications',
  'Logistics & Wayfinding',
];

const eligibility = [
  'Must be at least 18 years old by November 1, 2026.',
  'Resident in or able to self-fund travel and accommodation in Addis Ababa during the conference.',
  'Available full-time from November 21–27, 2026 (includes two mandatory training days prior to the event).',
  'Fluent in English or Amharic; proficiency in French, Arabic, Portuguese, or Kiswahili is a strong advantage.',
  'Background or strong interest in public health, medicine, international relations, event management, or communications.',
];

export default function PublicHomePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f3f7f6', color: '#102a2d' }}>
      <section
        style={{
          backgroundImage: 'linear-gradient(90deg, rgba(11, 59, 57, 0.88) 0%, rgba(11, 59, 57, 0.72) 42%, rgba(11, 59, 57, 0.45) 100%), url("/hero.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fff',
          padding: '72px 20px 48px',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 12 }}>CPHIA 2026</div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>Africa CDC • Government of Ethiopia</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 32, alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 700, color: '#e6f8f2' }}>
                Volunteer Opportunity
              </p>
              <h1 style={{ margin: '16px 0 20px', fontSize: 'clamp(2.5rem, 5vw, 4.4rem)', lineHeight: 1.08 }}>
                Shape the Future of African Health: Volunteer at CPHIA 2026
              </h1>
              <p style={{ margin: 0, maxWidth: 700, fontSize: 20, lineHeight: 1.6, color: '#eafaf7' }}>
                Join Africa CDC and the Government of Ethiopia in welcoming 30,000+ global health leaders, researchers, and policymakers to Addis Ababa this November.
              </p>

              <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <a
                  href="/register"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #D4AF37, #F5C518)',
                    color: '#0d1b1f',
                    fontWeight: 800,
                    textDecoration: 'none',
                    borderRadius: 14,
                    padding: '0.95rem 1.5rem',
                    boxShadow: '0 14px 28px rgba(0,0,0,0.15)',
                  }}
                >
                  Apply to Volunteer Now
                </a>
              </div>

              <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {highlights.map((item) => (
                  <div
                    key={item}
                    style={{
                      background: 'rgba(255,255,255,0.10)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      padding: '0.8rem 1rem',
                      borderRadius: 999,
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 24,
                padding: 12,
                boxShadow: '0 20px 35px rgba(0,0,0,0.10)',
                overflow: 'hidden',
              }}
            >
              <img
                src="/hero.jpg"
                alt="CPHIA 2026 conference landscape"
                style={{
                  width: '100%',
                  height: 460,
                  display: 'block',
                  objectFit: 'cover',
                  borderRadius: 18,
                }}
              />
              <div style={{ padding: '18px 10px 8px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.85 }}>
                  Volunteer Impact
                </div>
                <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
                  <Metric label="Delegates" value="30,000+" />
                  <Metric label="Countries" value="50+" />
                  <Metric label="Sessions" value="200+" />
                  <Metric label="Volunteer Team" value="600+" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 20px 10px' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ maxWidth: 760 }}>
            <p style={{ margin: 0, color: '#186059', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 12 }}>
              About the Opportunity
            </p>
            <h2 style={{ margin: '12px 0 16px', fontSize: 'clamp(1.9rem, 3vw, 2.8rem)' }}>Be part of a historic public health gathering</h2>
            <p style={{ margin: 0, color: '#3b4b4e', lineHeight: 1.8, fontSize: 17 }}>
              The 5th International Conference on Public Health in Africa (CPHIA 2026) is convening under the theme
              <em style={{ fontStyle: 'italic' }}> “Africa’s Health Security and Sovereignty.”</em> As a volunteer, you will be on the frontlines of a historic gathering focused on pandemic preparedness, local medical manufacturing, primary health care, and digital health innovation. We are looking for passionate, reliable individuals to help deliver a world-class experience in the heart of Africa’s diplomatic capital.
            </p>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 20px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
          {reasons.map((reason) => (
            <article key={reason.title} style={{ background: '#ffffff', borderRadius: 20, padding: 24, border: '1px solid #dfeae8', boxShadow: '0 10px 18px rgba(16,42,45,0.04)' }}>
              <p style={{ margin: 0, color: '#186059', fontWeight: 800, fontSize: 14, letterSpacing: 1.1, textTransform: 'uppercase' }}>Why volunteer</p>
              <h3 style={{ margin: '12px 0 10px', fontSize: '1.2rem' }}>{reason.title}</h3>
              <p style={{ margin: 0, color: '#4a5c60', lineHeight: 1.7 }}>{reason.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 20px 10px' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div>
            <p style={{ margin: 0, color: '#186059', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 12 }}>
              Volunteer Roles & Areas
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: 'clamp(1.9rem, 3vw, 2.8rem)' }}>Support a world-class conference experience</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {roles.map((role) => (
              <div key={role} style={{ background: '#ffffff', borderRadius: 18, padding: 18, border: '1px solid #dfeae8' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #F5C518)', display: 'inline-block' }} />
                <p style={{ margin: '10px 0 0', fontWeight: 700, color: '#173d3f', lineHeight: 1.5 }}>{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 20px 80px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0f5d57 0%, #1a7a69 100%)', borderRadius: 30, padding: '40px 24px', textAlign: 'center', color: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(2rem, 3vw, 3rem)' }}>Ready to Represent Ethiopia and the Continent?</h2>
          <p style={{ margin: '14px auto 0', maxWidth: 680, color: '#eafaf7', fontSize: 18, lineHeight: 1.7 }}>
            Applications close soon. Secure your spot on the CPHIA 2026 Volunteer Team today.
          </p>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #D4AF37, #F5C518)',
                color: '#0d1b1f',
                fontWeight: 800,
                textDecoration: 'none',
                borderRadius: 14,
                padding: '0.95rem 1.6rem',
              }}
            >
              Start Your Application
            </a>
          </div>
          <p style={{ marginTop: 24, fontSize: 16, color: '#effcf8' }}>
            Questions? Contact the Volunteer Coordination Desk at <a href="mailto:volunteers@cphia.africacdc.org" style={{ color: '#fff', fontWeight: 700 }}>volunteers@cphia.africacdc.org</a>
          </p>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.14)', paddingBottom: 10 }}>
      <span style={{ opacity: 0.85, fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: 25 }}>{value}</strong>
    </div>
  );
}
