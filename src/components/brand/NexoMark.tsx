type NexoMarkProps = {
  className?: string;
};

/** Logo Nexo — kim cương bo góc + sóng N, theo mark khách gửi. */
export function NexoMark({ className = "h-9 w-9" }: NexoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`shrink-0 text-slate-900 ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 9 C34.6 9 37 10.1 38.8 11.9 L52.1 25.2 C55.8 28.9 55.8 35.1 52.1 38.8 L38.8 52.1 C37 53.9 34.6 55 32 55 C29.4 55 27 53.9 25.2 52.1 L11.9 38.8 C8.2 35.1 8.2 28.9 11.9 25.2 L25.2 11.9 C27 10.1 29.4 9 32 9 Z" />
        <path d="M20.5 37.5 C24 37.5 26.2 26.5 32 26.5 C37.8 26.5 40 37.5 43.5 37.5" />
      </g>
    </svg>
  );
}

export function NexoWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-wide text-slate-900 ${className}`}>NEXO</span>
  );
}
