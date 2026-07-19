import Link from "next/link";
import { OpenSettingsLink } from "@/components/settings/open-settings-link";

export default function HelpPage() {
  return (
    <div className="flex flex-col">
      <header className="border-b border-border bg-card px-4 py-2.5">
        <h1 className="text-base font-semibold">Help — How Calculations Work</h1>
        <p className="text-[11px] text-muted-foreground">
          Calibrate rates once; every estimate gets more accurate
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 p-4 text-[13px] leading-relaxed">
        <section className="panel p-4">
          <h2 className="font-semibold">Formulas</h2>
          <dl className="mt-2 space-y-2 font-mono text-[12px]">
            <div>
              <dt className="text-muted-foreground">Gallons</dt>
              <dd>
                (paint_area × coats × (1 + waste%)) ÷ spread_rating_sqft_per_gallon
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paint area (unit surfaces)</dt>
              <dd>
                Trim/crown LF used directly; doors × 40 sf; windows × 10 sf;
                cabinets × 8 sf
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Room walls (interior)</dt>
              <dd>
                perimeter = 2×(L+W); wall net = perimeter×H − (doors×20 + windows×15)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Labor hours</dt>
              <dd>
                first/additional coat rates when set; else (measure × coats) ÷ rate ×
                condition
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Prep hours</dt>
              <dd>paint labor hours × prep%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Material $</dt>
              <dd>gallons × price_per_gallon × (1 + markup%)</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Labor $</dt>
              <dd>(paint + prep hours) × blended_labor_rate</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sales rate</dt>
              <dd>grand total ÷ total hours</dd>
            </div>
          </dl>
          <p className="mt-3 text-muted-foreground">
            Expand any surface row to see step-by-step show-work math. Condition
            multipliers: easy ×0.9, medium ×1.0, hard ×1.25.
          </p>
        </section>

        <section className="panel p-4">
          <h2 className="font-semibold">Room-first workflow</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Click <strong className="text-foreground">Add Interior Room</strong>{" "}
              (or Exterior Surface).
            </li>
            <li>Enter L×W×H, doors, and windows — walls/ceiling/baseboard auto-calc.</li>
            <li>Choose which surfaces to include; coats, method, and product per surface.</li>
            <li>Add extras (sundries, travel, disposal), set discount and prep %.</li>
            <li>Export Markdown, PDF, or JSON — or open the printable proposal.</li>
          </ol>
        </section>

        <section className="panel p-4">
          <h2 className="font-semibold">Spread rating (sq ft / gallon)</h2>
          <p className="mt-2 text-muted-foreground">
            Each paint product has a spread rating — how many square feet one
            gallon covers. That rating is used for every surface that product is
            assigned to (walls, ceilings, exterior, etc.). Set a company
            standard in{" "}
            <OpenSettingsLink>
              Settings → Std. spread sf/gal
            </OpenSettingsLink>
            ; customize per product in the{" "}
            <Link href="/products" className="text-primary hover:underline">
              Product Library
            </Link>
            . Typical latex paints land around 350–400 sq ft/gal; primers and
            rough/stucco surfaces often cover less.
          </p>
        </section>

        <section className="panel p-4">
          <h2 className="font-semibold">Calibrating production rates</h2>
          <p className="mt-2 text-muted-foreground">
            Default interior rates assume{" "}
            <strong className="text-foreground">2 coats, moderate residential</strong>
            {" "}(e.g. smooth walls ~90 sqft/hr, trim ~28 LF/hr). Calibrate to your
            crew — spray looks faster but must include backroll and masking.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Pick a completed room/job you know well.</li>
            <li>
              Divide painted sqft × coats by actual man-hours spent on that surface.
            </li>
            <li>
              Update{" "}
              <OpenSettingsLink>
                Settings → Production Rates
              </OpenSettingsLink>
              .
            </li>
            <li>Re-estimate a known job and compare — iterate until it feels right.</li>
          </ol>
        </section>

        <section className="panel p-4">
          <h2 className="font-semibold">Keyboard & workflow tips</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Start with the sample bedroom template (12×15×8, 2 doors, 2 windows).
            </li>
            <li>
              Wall calculator icon overrides irregular rooms with segment/opening math.
            </li>
            <li>Product Library is its own nav page; production rates stay in Settings.</li>
            <li>Accept estimate advances/creates a Job in Scheduled status.</li>
            <li>Import/export estimate JSON from the Estimates list; full backup in Settings.</li>
          </ul>
        </section>

        <section className="panel p-4">
          <h2 className="font-semibold">Out of scope (later)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Supabase Auth + multi-user / cloud sync</li>
            <li>Customer portal / public share links</li>
            <li>Actual vs estimate variance tracking</li>
            <li>AI photo takeoff / voice (Grok API slot)</li>
            <li>Scheduling, dispatch, invoicing</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
