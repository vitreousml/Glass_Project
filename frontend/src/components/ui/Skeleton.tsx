/** Loading placeholder shaped like the content it stands in for. Pulses only while loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none ${className}`} />;
}
