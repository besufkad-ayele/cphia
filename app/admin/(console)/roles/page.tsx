'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

function summarizeAccess(access: AccessDraft) {
  const modules = access.modules.length;
  const details = access.modules.includes('volunteers')
    ? access.details.length + 1
    : access.details.length;
  return `${modules} module${modules === 1 ? '' : 's'} · ${details} detail${details === 1 ? '' : 's'}`;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [draft, setDraft] = useState({ name: '', description: '', access: emptyDraft });
  const [error, setError] = useState<string | null>(null);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);

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
      toast.success('Role access saved. People on this role pick up the new detail permissions on their next page load.');
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
      if (openRoleId === role.id) setOpenRoleId(null);
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
        description="Turn on modules, then open a module to choose its detail permissions. Enabling a module starts with the full detail set — uncheck Submit / Reopen (and others) to hide those actions."
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
          <RoleCard
            key={role.id}
            role={role}
            open={openRoleId === role.id}
            onToggle={() => setOpenRoleId((current) => (current === role.id ? null : role.id))}
            onSave={save}
            onDelete={remove}
          />
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
  const [openFeature, setOpenFeature] = useState<FeatureKey | null>(null);

  function toggleModule(key: FeatureKey) {
    const enabled = value.modules.includes(key);
    if (enabled) {
      const remainingDetails = value.details.filter((item) => !String(item).startsWith(`${key}.`));
      onChange({
        ...value,
        modules: value.modules.filter((item) => item !== key),
        details: remainingDetails,
      });
      setOpenFeature((current) => (current === key ? null : current));
      return;
    }
    const defaults = detailsForFeature(key)
      .map((item) => item.key as PermissionKey)
      .filter(() => key !== 'volunteers');
    onChange({
      ...value,
      modules: [...value.modules, key],
      details: [...value.details.filter((item) => !String(item).startsWith(`${key}.`)), ...defaults],
      volunteerAccess: key === 'volunteers' ? 'volunteers.access.full' : value.volunteerAccess,
    });
    setOpenFeature(key);
  }

  function toggleDetail(key: PermissionKey) {
    const enabled = value.details.includes(key);
    onChange({
      ...value,
      details: enabled ? value.details.filter((item) => item !== key) : [...value.details, key],
    });
  }

  function toggleFeatureOpen(key: FeatureKey) {
    const enabled = value.modules.includes(key) || locked;
    if (!enabled) return;
    setOpenFeature((current) => (current === key ? null : key));
  }

  return (
    <div className="grid gap-3">
      {ADMIN_FEATURES.map((feature) => {
        const checked = value.modules.includes(feature.key);
        const caps = detailsForFeature(feature.key);
        const detailsOpen = (checked || locked) && openFeature === feature.key;
        const selectedCount =
          feature.key === 'volunteers'
            ? checked || locked
              ? 1
              : 0
            : caps.filter((cap) => locked || value.details.includes(cap.key as PermissionKey)).length;

        return (
          <div key={feature.key} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[#e7c15a]"
                checked={checked || locked}
                disabled={locked}
                aria-label={`Enable ${feature.label}`}
                onChange={() => toggleModule(feature.key)}
              />
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1 text-left',
                  checked || locked ? 'cursor-pointer' : 'cursor-default',
                )}
                disabled={!checked && !locked}
                onClick={() => toggleFeatureOpen(feature.key)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium text-white">{feature.label}</span>
                    <span className="block text-xs text-zinc-400">{feature.detail}</span>
                    {checked || locked ? (
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {detailsOpen
                          ? 'Hide detail permissions'
                          : `Show detail permissions · ${selectedCount} selected`}
                      </span>
                    ) : null}
                  </span>
                  {checked || locked ? (
                    <ChevronDown
                      className={cn(
                        'mt-0.5 size-4 shrink-0 text-zinc-400 transition',
                        detailsOpen && 'rotate-180 text-[#e7c15a]',
                      )}
                    />
                  ) : null}
                </span>
              </button>
            </div>

            {detailsOpen && feature.key === 'volunteers' ? (
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

            {detailsOpen && feature.key !== 'volunteers' && caps.length > 0 ? (
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
  open,
  onToggle,
  onSave,
  onDelete,
}: {
  role: Role;
  open: boolean;
  onToggle: () => void;
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
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {role.name}{' '}
              {role.is_system ? (
                <span className="rounded-full bg-[#e7c15a]/15 px-2 py-0.5 text-xs text-[#f6e7b2]">System</span>
              ) : null}
            </CardTitle>
            <CardDescription className="mt-1">
              {role.key}
              {!open ? ` · ${summarizeAccess(access)}` : null}
            </CardDescription>
            {!open ? (
              <p className="mt-2 text-xs text-zinc-500">Click to edit modules and detail permissions</p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'mt-1 size-5 shrink-0 text-zinc-400 transition',
              open && 'rotate-180 text-[#e7c15a]',
            )}
          />
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="grid gap-3 border-t border-white/10 pt-4">
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
      ) : null}
    </Card>
  );
}
