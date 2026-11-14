'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/app/lib/admin/messages';
import { canControlRegistrationGate } from '@/app/lib/admin/ops-audit-access';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GateState = {
  open: boolean;
  source: 'desk' | 'env';
  envLocked: boolean;
};

export function RegistrationGateToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<GateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  async function loadGate() {
    setError(null);
    try {
      const response = await fetch('/api/admin/settings/registration');
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setAllowed(false);
        setState(null);
        return;
      }
      if (!response.ok) {
        throw new Error(
          typeof payload?.message === 'string'
            ? payload.message
            : 'Could not load registration gate.',
        );
      }
      setAllowed(true);
      setState({
        open: Boolean(payload.open),
        source: payload.source === 'env' ? 'env' : 'desk',
        envLocked: Boolean(payload.envLocked),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load registration gate.');
      setState(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const me = await fetch('/api/admin/me').then((response) => (response.ok ? response.json() : null));
        if (cancelled) return;
        if (!canControlRegistrationGate(me)) {
          setAllowed(false);
          return;
        }
        setAllowed(true);
        await loadGate();
      } catch {
        if (!cancelled) setAllowed(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!state || state.envLocked || busy) return;
    const next = !state.open;
    setBusy(true);
    try {
      const payload = await adminFetch<GateState & { ok?: boolean }>('/api/admin/settings/registration', {
        method: 'PATCH',
        body: JSON.stringify({ open: next }),
      });
      setState({
        open: payload.open,
        source: payload.source || 'desk',
        envLocked: Boolean(payload.envLocked),
      });
      toast.success(next ? 'Public registration is open' : 'Public registration is closed');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update registration.');
      await loadGate();
    } finally {
      setBusy(false);
    }
  }

  // Hidden for everyone except the designated desk-owner account.
  if (allowed !== true) return null;

  if (error && !state) {
    return (
      <p className={cn('text-xs text-amber-300/90', className)}>
        Registration toggle unavailable. {error.includes('MIGRATION') ? 'Apply migration 022.' : error}
      </p>
    );
  }

  if (!state) {
    return (
      <div className={cn('h-11 w-40 animate-pulse rounded-xl bg-white/10', className)} aria-hidden />
    );
  }

  const label = state.open ? 'Registration open' : 'Registration closed';

  return (
    <div className={cn('flex flex-col items-stretch gap-1 sm:items-end', className)}>
      <Button
        type="button"
        variant={state.open ? 'default' : 'outline'}
        disabled={busy || state.envLocked}
        onClick={() => void toggle()}
        className={cn(
          'h-11 min-w-[11rem]',
          state.open
            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
            : 'border-rose-400/40 text-rose-100 hover:bg-rose-500/10',
        )}
        title={
          state.envLocked
            ? 'Locked by NEXT_PUBLIC_REGISTRATION_OPEN on the server'
            : 'Toggle public /register for volunteers'
        }
      >
        {busy ? 'Saving…' : compact ? (state.open ? 'Open' : 'Closed') : label}
      </Button>
      <p className="text-[11px] text-zinc-500">
        {state.envLocked
          ? 'Locked by server env — clear NEXT_PUBLIC_REGISTRATION_OPEN to use this button.'
          : state.open
            ? 'Volunteers can submit on /register'
            : 'Public form shows closed — tap to reopen'}
      </p>
    </div>
  );
}
