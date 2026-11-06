import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoginLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-primary p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading admin sign in</span>
      <div className="grid w-full max-w-md gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </main>
  );
}
