'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Role = { id: string; key: string; name: string; permissions: string[] };
type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  role_key: string | null;
  created_at: string;
};

const emptyForm = { fullName: '', email: '', password: '', roleId: '', status: 'active' };

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const payload = await adminFetch<{ users: AdminUser[]; roles: Role[] }>('/api/admin/users');
    setUsers(payload.users);
    setRoles(payload.roles);
    setForm((current) => ({ ...current, roleId: current.roleId || payload.roles[0]?.id || '' }));
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  async function save() {
    try {
      if (editing) {
        await adminFetch(`/api/admin/users/${editing}`, { method: 'PATCH', body: JSON.stringify(form) });
        toast.success('Account updated.');
      } else {
        await adminFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Account created.');
      }
      setEditing(null);
      setForm({ ...emptyForm, roleId: roles[0]?.id || '' });
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the account.');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this admin account?')) return;
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      toast.success('Account removed.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not remove the account.');
    }
  }

  function edit(user: AdminUser) {
    setEditing(user.id);
    setForm({
      fullName: user.full_name || '',
      email: user.email,
      password: '',
      roleId: roles.find((role) => role.key === user.role_key)?.id || roles[0]?.id || '',
      status: user.status,
    });
  }

  return (
    <div className="grid gap-6">
      <PageHeader kicker="SUPER ADMIN" title="Team" description="Create desk accounts and attach a role. The role decides which modules they can open." />
      <Banner message={error} />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>{editing ? 'Edit account' : 'New account'}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Full name"><input className={controlClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></Field>
            <Field label="Email"><input className={controlClass} type="email" value={form.email} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label={editing ? 'New password (optional)' : 'Password'}>
              <input className={controlClass} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </Field>
            <Field label="Role">
              <select className={controlClass} value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </Field>
            {editing ? (
              <Field label="Status">
                <select className={controlClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </Field>
            ) : null}
            <div className="flex gap-2">
              <Button className="h-11" onClick={() => void save()}>{editing ? 'Save account' : 'Create account'}</Button>
              {editing ? <Button variant="outline" className="h-11" onClick={() => { setEditing(null); setForm({ ...emptyForm, roleId: roles[0]?.id || '' }); }}>Cancel</Button> : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>People with desk access</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {loading ? <p className="text-sm text-zinc-400">Loading accounts…</p> : null}
            {users.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <div>
                  <p className="font-medium text-white">{user.full_name || user.email}</p>
                  <p className="text-xs text-zinc-400">{user.email} · {(user.role_key || user.role).replace(/_/g, ' ')} · {user.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => edit(user)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(user.id)}>Remove</Button>
                </div>
              </div>
            ))}
            {!loading && users.length === 0 ? <p className="text-sm text-zinc-400">No accounts yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
