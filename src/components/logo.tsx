type LogoProps = {
  variant?: "full" | "icon" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Light wordmark for dark backgrounds (landing / sidebar). */
  invert?: boolean;
};

const iconSizes = { sm: 28, md: 36, lg: 48, xl: 72 };
const wordmarkSizes = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl md:text-5xl",
};

function LogoIcon({
  size = 36,
  titleId,
}: {
  size?: number;
  titleId?: string;
}) {
  const gid = titleId ?? "pap";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PainterApps Pro"
    >
      <title>PainterApps Pro</title>
      {/* Plate */}
      <rect width="48" height="48" rx="5" fill="#0f1e38" />
      <rect
        x="1.25"
        y="1.25"
        width="45.5"
        height="45.5"
        rx="4"
        stroke="#8d9aad"
        strokeWidth="1.25"
        opacity="0.85"
      />
      {/* Paint stripe */}
      <defs>
        <linearGradient
          id={`${gid}-stripe`}
          x1="0"
          y1="0"
          x2="0"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#b7d4f5" />
          <stop offset="45%" stopColor="#4a90d9" />
          <stop offset="100%" stopColor="#1e5aa8" />
        </linearGradient>
        <linearGradient
          id={`${gid}-p`}
          x1="16"
          y1="10"
          x2="36"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e8eef5" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="7" height="48" fill={`url(#${gid}-stripe)`} />
      {/* Soft inner highlight on stripe */}
      <rect x="0" y="0" width="2" height="48" fill="#ffffff" opacity="0.18" />
      {/* P */}
      <path
        d="M17 9.5h10.2c6.4 0 10.8 4.1 10.8 10.1 0 6-4.4 10.1-10.8 10.1H21.5V38.5H17V9.5zm4.5 6.2v7.8h5.4c2.55 0 4.35-1.7 4.35-3.9S29.45 15.7 26.9 15.7H21.5z"
        fill={`url(#${gid}-p)`}
      />
      {/* Baseline mark — job ticket / level */}
      <rect
        x="17"
        y="41.5"
        width="22"
        height="1.75"
        rx="0.5"
        fill="#6a7889"
        opacity="0.75"
      />
    </svg>
  );
}

export function Logo({
  variant = "full",
  size = "md",
  className = "",
  invert = false,
}: LogoProps) {
  const iconSize = iconSizes[size];
  const wordmarkClass = wordmarkSizes[size];
  const word =
    invert
      ? "text-white"
      : "text-foreground";
  const muted = invert ? "text-sky-200/80" : "text-muted-foreground";

  if (variant === "icon") {
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        <LogoIcon size={iconSize} titleId={`icon-${size}`} />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={`inline-flex font-semibold tracking-tight ${word} ${wordmarkClass} ${className}`}
      >
        Painter<span className={muted}>Apps</span>
        <span className={`ml-1.5 font-medium ${muted}`}>Pro</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} titleId={`full-${size}`} />
      <span
        className={`font-semibold tracking-tight ${word} ${wordmarkClass}`}
      >
        Painter<span className={muted}>Apps</span>
        <span className={`ml-1.5 text-[0.85em] font-medium ${muted}`}>
          Pro
        </span>
      </span>
    </span>
  );
}
