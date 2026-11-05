export default function AdminPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: 'linear-gradient(135deg, #186059, #2DAE95)' }}>
      <section style={{ width: '100%', maxWidth: 820, background: '#fff', color: '#111', borderRadius: 18, padding: 24 }}>
        <h1>Admin Portal</h1>
        <p>Admin dashboard placeholder for the route-based setup.</p>
        <a href="/" style={{ color: '#186059', fontWeight: 700 }}>Back home</a>
      </section>
    </main>
  );
}
