type LogoProps = {
  variant?: "full" | "icon" | "wordmark";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const iconSizes = { sm: 28, md: 36, lg: 48 };
const wordmarkSizes = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };

function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="4" fill="#0f1e38" />
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="3"
        stroke="#8d9aad"
        strokeWidth="1.5"
      />
      <defs>
        <linearGradient id="painterapps-logo-stripe" x1="0" y1="0" x2="0" y2="48">
          <stop offset="0%" stopColor="#9ec5f0" />
          <stop offset="50%" stopColor="#4a90d9" />
          <stop offset="100%" stopColor="#2b6cb8" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="6" height="48" fill="url(#painterapps-logo-stripe)" />
      <path
        d="M16 10h10c6 0 10 4 10 9.5S32 29 26 29h-6v9H16V10zm6 6v7h4c2.2 0 4-1.6 4-3.5S28.2 16 26 16h-4z"
        fill="#eef1f5"
      />
      <rect x="8" y="42" width="32" height="2" fill="#6a7889" fillOpacity="0.7" />
    </svg>
  );
}

export function Logo({
  variant = "full",
  size = "md",
  className = "",
}: LogoProps) {
  const iconSize = iconSizes[size];
  const wordmarkClass = wordmarkSizes[size];

  if (variant === "icon") {
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        <LogoIcon size={iconSize} />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={`inline-flex tracking-tight text-foreground ${wordmarkClass} ${className}`}
      >
        PAINTER<span className="text-muted-foreground">APPS</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      <span className={`tracking-tight text-foreground ${wordmarkClass}`}>
        PAINTER<span className="text-muted-foreground">APPS</span>
      </span>
    </span>
  );
}
