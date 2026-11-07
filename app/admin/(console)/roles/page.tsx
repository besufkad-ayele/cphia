'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ADMIN_FEATURES,
  VOLUNTEER_ACCESS_LEVELS,
  buildPermissions,
  detailsForFeature,
  parsePermissionState,
  type AccessDraft,
  type FeatureKey,
  type PermissionKey,
  type VolunteerAccessKey,
} from '@/app/lib/admin/permissions';
import { adminFetch } from '@/app/lib/admin/messages';
import { Banner, controlClass, Field, PageHeader } from '@/components/admin/console';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Role = {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  is_system: boolean;
};

const emptyDraft: AccessDraft = {
  modules: ['dashboard'],
  details: detailsForFeature('dashboard').map((item) => item.key as PermissionKey),
  volunteerAccess: 'volunteers.access.full',
};

function permissionsFromDraft(draft: AccessDraft) {
  return buildPermissions(draft);
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [draft, setDraft] = useState({ name: '', description: '', access: emptyDraft });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const payload = await adminFetch<{ roles: Role[] }>('/api/admin/roles');
    setRoles(payload.roles);
  }

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function createRole() {
    try {
      await adminFetch('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          permissions: permissionsFromDraft(draft.access),
        }),
      });
      setDraft({ name: '', description: '', access: emptyDraft });
      toast.success('Role created.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not create the role.');
    }
  }

  async function save(role: Role, next: { name: string; description: string; permissions: PermissionKey[] }) {
    try {
      await adminFetch(`/api/admin/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify(next) });
      toast.success('Role access saved. People on this role pick it up at their next sign-in, and stored access is updated now.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the role.');
    }
  }

  async function remove(role: Role) {
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    try {
      await adminFetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
      toast.success('Role deleted.');
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the role.');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="ACCESS"
        title="Roles"
        description="Turn on modules, then choose the detail permissions inside each one. Enabling a module starts with the full detail set."
      />
      <Banner message={error} />
      <Card>
        <CardHeader>
          <CardTitle>New role</CardTitle>
          <CardDescription>Start from the modules this person actually works in.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <input
                className={controlClass}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label="Description">
              <input
                className={controlClass}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>
          </div>
          <FeatureAccessEditor
            value={draft.access}
            locked={false}
            onChange={(access) => setDraft({ ...draft, access })}
          />
          <Button className="h-11 w-fit" onClick={() => void createRole()}>
            Create role
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} onSave={save} onDelete={remove} />
        ))}
      </div>
    </div>
  );
}

function FeatureAccessEditor({
  value,
  locked,
  onChange,
}: {
  value: AccessDraft;
  locked: boolean;
  onChange: (next: AccessDraft) => void;
}) {
  function toggleModule(key: FeatureKey) {
    const enabled = value.modules.includes(key);
    if (enabled) {
      const remainingDetails = value.details.filter((item) => !String(item).startsWith(`${key}.`));
      onChange({
        ...value,
        modules: value.modules.filter((item) => item !== key),
        details: remainingDetails,
      });
      return;
    }
    const defaults = detailsForFeature(key)
      .map((item) => item.key as PermissionKey)
      .filter((item) => key !== 'volunteers');
    onChange({
      ...value,
      modules: [...value.modules, key],
      details: [...value.details.filter((item) => !String(item).startsWith(`${key}.`)), ...defaults],
      volunteerAccess: key === 'volunteers' ? 'volunteers.access.full' : value.volunteerAccess,
    });
  }

  function toggleDetail(key: PermissionKey) {
    const enabled = value.details.includes(key);
    onChange({
      ...value,
      details: enabled ? value.details.filter((item) => item !== key) : [...value.details, key],
    });
  }

  return (
    <div className="grid gap-3">
      {ADMIN_FEATURES.map((feature) => {
        const checked = value.modules.includes(feature.key);
        const caps = detailsForFeature(feature.key);
        return (
          <div key={feature.key} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[#e7c15a]"
                checked={checked || locked}
                disabled={locked}
                onChange={() => toggleModule(feature.key)}
              />
              <span>
                <span className="block font-medium text-white">{feature.label}</span>
                <span className="block text-xs text-zinc-400">{feature.detail}</span>
              </span>
            </label>

            {feature.key === 'volunteers' && (checked || locked) ? (
              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[#e7c15a]">
                  Volunteer access
                </p>
                <select
                  className={controlClass}
                  disabled={locked}
                  value={locked ? 'volunteers.access.full' : value.volunteerAccess}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      volunteerAccess: event.target.value as VolunteerAccessKey,
                    })
                  }
                >
                  {VOLUNTEER_ACCESS_LEVELS.map((level) => (
                    <option key={level.key} value={level.key}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">
                  {
                    VOLUNTEER_ACCESS_LEVELS.find(
                      (level) =>
                        level.key === (locked ? 'volunteers.access.full' : value.volunteerAccess),
                    )?.detail
                  }
                </p>
              </div>
            ) : null}

            {feature.key !== 'volunteers' && (checked || locked) && caps.length > 0 ? (
              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs font-medium uppercase tracking-wide text-[#e7c15a]">
                  {feature.label} details
                </p>
                {caps.map((cap) => (
                  <label key={cap.key} className="flex gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-[#e7c15a]"
                      checked={locked || value.details.includes(cap.key as PermissionKey)}
                      disabled={locked}
                      onChange={() => toggleDetail(cap.key as PermissionKey)}
                    />
                    <span>
                      <span className="block text-white">{cap.label}</span>
                      <span className="block text-xs text-zinc-500">{cap.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RoleCard({
  role,
  onSave,
  onDelete,
}: {
  role: Role;
  onSave: (role: Role, next: { name: string; description: string; permissions: PermissionKey[] }) => Promise<void>;
  onDelete: (role: Role) => Promise<void>;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [access, setAccess] = useState<AccessDraft>(() => parsePermissionState(role.permissions));
  const locked = role.key === 'super_admin';

  useEffect(() => {
    setName(role.name);
    setDescription(role.description);
    setAccess(parsePermissionState(role.permissions));
  }, [role]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {role.name}{' '}
          {role.is_system ? (
            <span className="rounded-full bg-[#e7c15a]/15 px-2 py-0.5 text-xs text-[#f6e7b2]">System</span>
          ) : null}
        </CardTitle>
        <CardDescription>{role.key}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <input className={controlClass} value={name} disabled={locked} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <input
              className={controlClass}
              value={description}
              disabled={locked}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
        <FeatureAccessEditor value={access} locked={locked} onChange={setAccess} />
        {locked ? (
          <p className="text-xs text-zinc-400">Super admin keeps every module and every detail feature.</p>
        ) : (
          <div className="flex gap-2">
            <Button
              className="h-11"
              onClick={() =>
                void onSave(role, {
                  name,
                  description,
                  permissions: permissionsFromDraft(access),
                })
              }
            >
              Save access
            </Button>
            {!role.is_system ? (
              <Button variant="destructive" className="h-11" onClick={() => void onDelete(role)}>
                Delete
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
