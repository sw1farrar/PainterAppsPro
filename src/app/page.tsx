import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "PainterApps Pro",
  description:
    "Local-first paint estimating for professional contractors.",
};

/**
 * Clean single-viewport landing.
 * P mark is the hero; wordmark sits under it on a shared center axis.
 * Sole control: Enter (top-right) → /dashboard
 */
export default function LandingPage() {
  return (
    <div className="landing relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0b1526] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 landing-atmosphere"
      />

      {/* Soft vignette — keeps focus on the lockup */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_42%,transparent_0%,rgba(8,14,24,0.55)_100%)]"
      />

      <header className="relative z-10 flex shrink-0 justify-end px-6 pt-5 pb-2 sm:px-10">
        <Link
          href="/dashboard"
          className="landing-fade-in inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-[13px] font-medium tracking-wide text-white/85 transition-colors duration-200 hover:border-white/35 hover:bg-white/[0.04] hover:text-white"
        >
          Enter
        </Link>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10">
        {/* Optical center: slightly above true middle */}
        <div className="landing-lockup -mt-[3vh] flex w-full max-w-lg flex-col items-center">
          {/*
            P mark is the hero. Stripe on the left makes the mark optically
            heavy on that side — nudge right so it sits on the same axis as
            the wordmark below.
          */}
          <div className="landing-mark translate-x-[3px]">
            <Logo
              variant="icon"
              size="xl"
              className="[&_svg]:h-[clamp(5.5rem,22vmin,8.5rem)] [&_svg]:w-[clamp(5.5rem,22vmin,8.5rem)] [&_svg]:shadow-[0_28px_90px_-28px_rgba(0,0,0,0.7)]"
            />
          </div>

          {/* Wordmark — shared vertical center axis with the mark */}
          <h1 className="landing-wordmark mt-[clamp(1.35rem,3.8vh,2.15rem)] text-center font-[family-name:var(--font-display)] text-[clamp(2rem,6.5vw,3.25rem)] font-semibold leading-none tracking-[-0.03em]">
            <span className="text-white">PainterApps</span>
            <span className="ml-[0.28em] font-medium text-[#8eb6e8]">Pro</span>
          </h1>

          <div
            aria-hidden
            className="landing-rule mt-[clamp(1.15rem,3vh,1.6rem)] h-px w-10 bg-white/25"
          />

          <p className="landing-tagline mt-[clamp(0.95rem,2.4vh,1.3rem)] max-w-[24ch] text-center text-[clamp(0.875rem,2vw,1.05rem)] leading-relaxed text-slate-400">
            Local-first estimating for painting contractors.
          </p>
        </div>
      </main>
    </div>
  );
}
