'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { CphiaLogo } from '@/components/brand/cphia-logo';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'cphia.admin.login';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as { email?: string; password?: string; remember?: boolean } | null;
      if (!saved) return;
      if (saved.email) setEmail(saved.email);
      if (saved.password) setPassword(saved.password);
      if (typeof saved.remember === 'boolean') setRemember(saved.remember);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const nextEmail = String(formData.get('email') ?? '');
    const nextPassword = String(formData.get('password') ?? '');
    if (remember) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: nextEmail, password: nextPassword, remember: true }));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const response = await fetch('/api/admin/login', { method: 'POST', body: formData });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error === 'MISCONFIGURED' ? 'Admin login is not configured.' : 'Invalid email or password.');
      setLoading(false);
      return;
    }
    window.location.assign('/admin');
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#050506] px-4 py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[#e7c15a]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] bottom-[-4rem] h-80 w-80 rounded-full bg-[#2dae95]/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />

      <section className="relative w-full max-w-[440px] rounded-[28px] border border-white/15 bg-white/6 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
        <CphiaLogo className="h-12 w-auto max-w-[210px] object-contain object-left" />
        <p className="mt-6 text-[11px] font-semibold tracking-[0.22em] text-[#e7c15a]">VOLUNTEER DESK</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Open the CPHIA-26 cohort: attendance, shifts, forms, and the people running them.</p>

        <form method="post" action="/admin/login" onSubmit={handleSubmit} autoComplete="on" className="mt-7 grid gap-4">
          <label className="grid gap-1.5 text-sm text-zinc-300" htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-2xl border border-white/10 bg-black/45 px-3 text-white outline-none focus-visible:border-[#e7c15a]/70 focus-visible:ring-3 focus-visible:ring-[#e7c15a]/25"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-zinc-300" htmlFor="password">
            Password
            <span className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/45 px-3 pr-12 text-white outline-none focus-visible:border-[#e7c15a]/70 focus-visible:ring-3 focus-visible:ring-[#e7c15a]/25"
              />
              <button
                type="button"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="mt-0.5 size-4 accent-[#e7c15a]"
            />
            <span>
              Remember email and password on this browser
              <span className="mt-0.5 block text-xs text-zinc-500">Stored only on this device. Uncheck to forget them after sign-in.</span>
            </span>
          </label>
          {error ? <p className="text-sm font-medium text-red-300">{error}</p> : null}
          <button type="submit" className={cn(buttonVariants(), 'h-12 rounded-2xl text-base')} disabled={loading}>
            {loading ? 'Signing in...' : 'Enter the desk'}
          </button>
        </form>
      </section>
    </main>
  );
}
