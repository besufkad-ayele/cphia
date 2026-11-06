export function CphiaLogo({ className = 'h-12 w-auto max-w-[220px] object-contain object-left sm:h-14 sm:max-w-none' }: { className?: string }) {
  return (
    <img
      src="/cphia%20logo.png"
      alt="CPHIA, International Conference on Public Health in Africa"
      className={className}
    />
  );
}
