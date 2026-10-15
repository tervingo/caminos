/** Concha del peregrino, como en el mock-up D */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 28 L4 13 C9 4 23 4 28 13 Z"
        fill="#E2AE2D"
        stroke="#14231C"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 28 L9 10 M16 28 L13 7 M16 28 L19 7 M16 28 L23 10" stroke="#14231C" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
