'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const formData = new FormData(event.currentTarget);
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
    <main className="grid min-h-screen place-items-center bg-primary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">CPHIA 2026</p>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>Use your seeded admin account to manage the CPHIA-26 volunteer cohort.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" required className="h-11" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
