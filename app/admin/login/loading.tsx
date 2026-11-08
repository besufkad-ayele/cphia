import { CphiaLoader } from '@/components/brand/cphia-loader';

export default function AdminLoginLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-primary p-4" aria-busy="true" aria-live="polite">
      <CphiaLoader size="lg" label="Loading admin sign in" />
    </main>
  );
}
