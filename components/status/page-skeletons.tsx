import { Skeleton } from '@/components/ui/skeleton';

export function HomeSkeleton() {
  return (
    <main className="h-dvh overflow-hidden bg-[#041816] px-4 py-4 text-white sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading CPHIA volunteer home</span>
      <div className="mx-auto flex h-full max-w-6xl flex-col">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-14 w-44 rounded-xl bg-white/80" />
          <Skeleton className="h-11 w-28 rounded-lg bg-white/20" />
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <Skeleton className="h-4 w-40 bg-white/25" />
          <Skeleton className="mt-4 h-12 w-full max-w-3xl bg-white/20" />
          <Skeleton className="mt-3 h-12 w-4/5 max-w-2xl bg-white/15" />
          <Skeleton className="mt-5 h-5 w-full max-w-xl bg-white/10" />
          <Skeleton className="mt-2 h-5 w-2/3 max-w-md bg-white/10" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-44 rounded-full bg-white/15" />
            <Skeleton className="h-8 w-64 rounded-full bg-white/15" />
            <Skeleton className="h-8 w-40 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function RegisterSkeleton() {
  return (
    <main className="min-h-screen bg-muted/40 px-3 pb-16 pt-4 md:px-6 lg:px-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading volunteer registration</span>
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-12 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-11" />
              <Skeleton className="h-9 w-11" />
              <Skeleton className="h-9 w-11" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:grid lg:gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-3 h-4 w-full max-w-md" />
            <div className="mt-6 grid gap-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-11 w-36" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function AdminSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading admin</span>
      <div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
