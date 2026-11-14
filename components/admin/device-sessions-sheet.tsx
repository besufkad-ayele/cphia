'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor, MonitorOff, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type DeviceRow = {
  id: string;
  label: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

type SessionsPayload = {
  currentSessionId: string | null;
  count: number;
  sessions: DeviceRow[];
  error?: string;
  message?: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isMobileLabel(label: string) {
  return /iPhone|iPad|Android/i.test(label);
}

export function DeviceSessionsButton({
  className,
  detailed = false,
  compact = false,
}: {
  className?: string;
  detailed?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/sessions');
      const payload = (await response.json().catch(() => ({}))) as SessionsPayload;
      if (response.status === 503) {
        setMigrationHint(payload.message || 'Apply migration 023 for device sessions.');
        setRows([]);
        setCount(0);
        return;
      }
      if (!response.ok) {
        throw new Error(payload.message || 'Could not load devices.');
      }
      setMigrationHint(null);
      setRows(payload.sessions || []);
      setCount(payload.count ?? payload.sessions?.length ?? 0);
      setSelected((prev) => prev.filter((id) => (payload.sessions || []).some((row) => row.id === id && !row.current)));
    } catch (reason) {
      if (open) {
        toast.error(reason instanceof Error ? reason.message : 'Could not load devices.');
      }
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function toggle(id: string, current: boolean) {
    if (current) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function selectAllOthers() {
    setSelected(rows.filter((row) => !row.current).map((row) => row.id));
  }

  async function revokeSelected() {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.message === 'string' ? payload.message : 'Could not sign out selected devices.',
        );
      }
      toast.success(
        payload.revoked === 1 ? '1 device signed out.' : `${payload.revoked || selected.length} devices signed out.`,
      );
      setSelected([]);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not sign out selected devices.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeAllOthers() {
    if (busy) return;
    if (!window.confirm('Sign out all other devices? This device stays signed in.')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/sessions/revoke-others', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.message === 'string' ? payload.message : 'Could not sign out other devices.',
        );
      }
      toast.success('Other devices signed out.');
      setSelected([]);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not sign out other devices.');
    } finally {
      setBusy(false);
    }
  }

  const otherCount = Math.max(0, (count ?? 0) - (rows.some((row) => row.current) ? 1 : 0));
  const badge = count == null ? null : count;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'relative text-zinc-300',
          detailed ? 'mt-3 h-10 w-full justify-start' : compact ? '' : 'mt-1 size-11',
          className,
        )}
        title="Devices signed in"
        onClick={() => setOpen(true)}
      >
        <span className="relative inline-flex">
          <Monitor className="size-4" />
          {badge != null && badge > 0 ? (
            <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e7c15a] px-1 text-[10px] font-semibold text-black">
              {badge > 9 ? '9+' : badge}
            </span>
          ) : null}
        </span>
        {detailed ? (
          <span className="ml-2 truncate">
            {count == null ? 'Devices' : count === 1 ? '1 device' : `${count} devices`}
          </span>
        ) : compact ? (
          <span className="ml-1.5">
            {count == null ? 'Devices' : `${count} device${count === 1 ? '' : 's'}`}
          </span>
        ) : (
          <span className="sr-only">Devices signed in</span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="admin-dark flex w-full flex-col border-white/10 bg-zinc-950 p-0 text-zinc-100 sm:max-w-md"
        >
          <SheetHeader className="border-b border-white/10 px-5 py-4 text-left">
            <SheetTitle className="text-white">Your devices</SheetTitle>
            <SheetDescription className="text-zinc-400">
              {count == null
                ? 'See where you are signed in, then select devices to revoke.'
                : `You are signed in on ${count} device${count === 1 ? '' : 's'}. Select others to sign them out.`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-5 py-3">
            <p className="text-xs text-zinc-500">
              {otherCount ? `${otherCount} other device${otherCount === 1 ? '' : 's'} can be revoked` : 'Only this device is active'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-zinc-300"
              disabled={loading || busy}
              onClick={() => void load()}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {migrationHint ? (
              <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                {migrationHint}
              </p>
            ) : null}

            {!migrationHint && !loading && rows.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No tracked devices yet. Sign out and sign back in once to start tracking this browser.
              </p>
            ) : null}

            <ul className="space-y-3">
              {rows.map((row) => {
                const Icon = isMobileLabel(row.label) ? Smartphone : Monitor;
                const checked = selected.includes(row.id);
                return (
                  <li key={row.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-2xl border px-3.5 py-3 transition',
                        row.current
                          ? 'border-[#e7c15a]/40 bg-[#e7c15a]/10'
                          : checked
                            ? 'border-rose-400/40 bg-rose-500/10'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                        row.current && 'cursor-default',
                      )}
                    >
                      <Checkbox
                        checked={row.current ? false : checked}
                        disabled={row.current || busy}
                        onCheckedChange={() => toggle(row.id, row.current)}
                        className="mt-1"
                      />
                      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-white">{row.label}</span>
                          {row.current ? (
                            <span className="rounded-full border border-[#e7c15a]/40 bg-[#e7c15a]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#f6e7b2]">
                              This device
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-500">
                          Last active {formatWhen(row.lastSeenAt)}
                          {row.ip ? ` · ${row.ip}` : ''}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-zinc-600">
                          Signed in {formatWhen(row.createdAt)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <SheetFooter className="mx-0 mb-0 gap-2 rounded-none border-t border-white/10 bg-black/40 px-5 py-4 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-white/5 text-zinc-100"
                disabled={busy || otherCount === 0}
                onClick={selectAllOthers}
              >
                Select others
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                disabled={busy || otherCount === 0}
                onClick={() => void revokeAllOthers()}
              >
                <MonitorOff className="size-4" />
                Sign out all others
              </Button>
            </div>
            <Button
              type="button"
              className="w-full bg-[#e7c15a] text-black hover:bg-[#f0d06e]"
              disabled={busy || selected.length === 0}
              onClick={() => void revokeSelected()}
            >
              {busy
                ? 'Signing out…'
                : selected.length
                  ? `Sign out ${selected.length} selected`
                  : 'Select devices to sign out'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
