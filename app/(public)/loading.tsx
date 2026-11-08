import { CphiaLoader } from '@/components/brand/cphia-loader';

export default function PublicLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#041816] p-4" aria-busy="true" aria-live="polite">
      <CphiaLoader size="lg" label="Loading CPHIA volunteer home" />
    </main>
  );
}
