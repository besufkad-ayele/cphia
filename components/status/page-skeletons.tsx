import { Skeleton } from '@/components/ui/skeleton';
import { CphiaLoader } from '@/components/brand/cphia-loader';

export function HomeSkeleton() {
  return (
    <main className="grid h-dvh place-items-center overflow-hidden bg-[#041816] px-4 py-4 text-white sm:px-6" aria-busy="true" aria-live="polite">
      <CphiaLoader size="lg" label="Loading CPHIA volunteer home" />
    </main>
  );
}

export function RegisterSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-3 pb-16 pt-4 md:px-6 lg:px-10" aria-busy="true" aria-live="polite">
      <CphiaLoader size="lg" label="Loading volunteer registration" />
    </main>
  );
}

export function AdminSkeleton() {
  return (
    <div className="grid min-h-[50vh] place-items-center" aria-busy="true" aria-live="polite">
      <CphiaLoader size="lg" label="Loading admin" />
    </div>
  );
}

/** Keep a light skeleton strip for dense list placeholders inside pages. */
export function ListRowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
