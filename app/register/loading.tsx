import { CphiaLoader } from '@/components/brand/cphia-loader';

export default function RegisterLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-4" aria-busy="true" aria-live="polite">
      <CphiaLoader size="lg" label="Loading volunteer registration" />
    </main>
  );
}
