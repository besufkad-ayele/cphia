'use client';

import { FormEvent, useState } from 'react';

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error === 'MISCONFIGURED' ? 'Admin login is not configured.' : 'Invalid email or password.');
      setLoading(false);
      return;
    }

    window.location.assign('/admin');
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0d3d3c 0%, #0f5d57 28%, #1b8a79 100%)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 24, padding: 28, boxShadow: '0 18px 42px rgba(0,0,0,0.12)' }}>
        <p style={{ margin: 0, letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 12, fontWeight: 800, color: '#d9f4ef' }}>
          CPHIA Admin
        </p>
        <h1 style={{ margin: '10px 0 18px', fontSize: '2rem', color: '#fff' }}>Sign in</h1>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8, color: '#effcf8', fontWeight: 700 }}>
            Email
            <input
              name="email"
              type="email"
              placeholder="admin@cphia.org"
              required
              autoComplete="username"
              style={{ minHeight: 48, width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '0 14px', fontSize: 16 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8, color: '#effcf8', fontWeight: 700 }}>
            Password
            <div style={{ position: 'relative' }}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                style={{ minHeight: 48, width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '0 46px 0 14px', fontSize: 16 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#d9f4ef', fontWeight: 800, cursor: 'pointer' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error ? <div style={{ color: '#ffdcdc', fontWeight: 700 }}>{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            style={{ minHeight: 48, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #F5C518)', color: '#112325', fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
