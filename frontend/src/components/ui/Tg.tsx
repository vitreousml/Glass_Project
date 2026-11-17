/** Tg, typeset with a proper subscript that doesn't disturb line height. */
export function Tg({ className = "" }: { className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      T<sub className="relative top-[0.25em] align-baseline text-[0.72em]">g</sub>
    </span>
  );
}

/** "B2O3" -> B₂O₃ with real subscripts (for headings where Unicode subscripts look thin). */
export function Formula({ children }: { children: string }) {
  const parts = children.split(/(\d+)/).filter(Boolean);
  return (
    <span className="whitespace-nowrap">
      {parts.map((p, i) =>
        /^\d+$/.test(p) ? (
          <sub key={i} className="relative top-[0.25em] align-baseline text-[0.72em]">
            {p}
          </sub>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
