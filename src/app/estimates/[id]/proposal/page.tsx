import Link from "next/link";
import { notFound } from "next/navigation";
import { getEstimate, getSettings } from "@/lib/actions";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { format } from "date-fns";
import { ProposalActions } from "./proposal-actions";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [estimateResult, settings] = await Promise.all([
    getEstimate(id)
      .then((estimate) => ({ ok: true as const, estimate }))
      .catch(() => ({ ok: false as const })),
    getSettings(),
  ]);
  if (!estimateResult.ok) notFound();
  const { estimate } = estimateResult;
  const rooms = estimate.rooms ?? [];
  const lines =
    rooms.length > 0
      ? rooms.flatMap((r) => r.surfaces)
      : estimate.lineItems;

  const materials = lines.reduce((s, l) => s + (l.materialCost ?? 0), 0);
  const labor = lines.reduce((s, l) => s + (l.laborCost ?? 0), 0);
  const extrasTotal = (estimate.extras ?? []).reduce((s, e) => {
    if (e.amountType === "percent_of_subtotal") {
      return s + (estimate.subtotal * e.amount) / 100;
    }
    return s + e.amount;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <div className="mx-auto flex max-w-[850px] items-center justify-between gap-2 px-4 py-3 print:hidden">
        <Link href={`/estimates/${id}`} className="text-[13px] text-primary hover:underline">
          ← Back to builder
        </Link>
        <ProposalActions estimateId={id} status={estimate.status} />
      </div>

      <article
        id="proposal"
        className="mx-auto mb-8 max-w-[850px] bg-white px-10 py-8 shadow-md print:mb-0 print:max-w-none print:shadow-none"
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {settings.companyName}
            </h1>
            <div className="mt-1 text-[12px] leading-relaxed text-slate-600">
              {[settings.address, [settings.city, settings.state, settings.zip].filter(Boolean).join(", ")]
                .filter(Boolean)
                .map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              {settings.phone && <div>{settings.phone}</div>}
              {settings.email && <div>{settings.email}</div>}
              {settings.website && <div>{settings.website}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Estimate
            </div>
            <div className="text-lg font-bold text-slate-900">
              {estimate.estimateNumber}
            </div>
            <div className="mt-1 text-[12px] text-slate-600">
              Date: {format(estimate.date, "MMM d, yyyy")}
              {estimate.validUntil && (
                <div>Valid until: {format(estimate.validUntil, "MMM d, yyyy")}</div>
              )}
            </div>
          </div>
        </header>

        {/* Customer */}
        <section className="mt-5 grid grid-cols-2 gap-6 text-[13px]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Prepared for
            </div>
            <div className="mt-1 font-semibold text-slate-900">
              {estimate.customer?.name ?? "—"}
            </div>
            {estimate.customer && (
              <div className="text-slate-600">
                {[
                  estimate.customer.address,
                  [estimate.customer.city, estimate.customer.state, estimate.customer.zip]
                    .filter(Boolean)
                    .join(", "),
                ]
                  .filter(Boolean)
                  .map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                {estimate.customer.phone && <div>{estimate.customer.phone}</div>}
                {estimate.customer.email && <div>{estimate.customer.email}</div>}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Project
            </div>
            <div className="mt-1 font-semibold text-slate-900">{estimate.title}</div>
          </div>
        </section>

        {/* Scope by room */}
        <section className="mt-6">
          <h2 className="border-b border-slate-300 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Scope of Work
          </h2>
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <div key={room.id} className="mt-4">
                <div className="text-[13px] font-semibold text-slate-900">
                  {room.name}
                  <span className="ml-2 text-[11px] font-normal text-slate-500">
                    {room.kind === "interior" &&
                    room.lengthFt != null &&
                    room.widthFt != null &&
                    room.heightFt != null
                      ? `${room.lengthFt}×${room.widthFt}×${room.heightFt} ft · ${room.doorCount} doors · ${room.windowCount} windows`
                      : room.kind}
                  </span>
                </div>
                <table className="mt-1 w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-2">Surface</th>
                      <th className="py-1.5 pr-2 text-right">Area/Qty</th>
                      <th className="py-1.5 pr-2 text-right">Coats</th>
                      <th className="py-1.5 pr-2">Product</th>
                      <th className="py-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.surfaces.map((li) => (
                      <tr key={li.id} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-medium text-slate-800">
                          {li.description}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-slate-700">
                          {li.measurementType === "unit"
                            ? `${formatNumber(li.quantity, 1)} ${li.unitLabel || ""}`
                            : `${formatNumber(li.inputAreaSqft, 0)} sf`}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {li.coats}
                        </td>
                        <td className="py-2 pr-2 text-slate-600">
                          {li.paintProduct
                            ? `${li.paintProduct.name}${li.paintProduct.sheen ? ` (${li.paintProduct.sheen})` : ""}`
                            : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium">
                          {formatCurrency(li.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <table className="mt-2 w-full text-[12px]">
              <tbody>
                {lines.map((li) => (
                  <tr key={li.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-medium text-slate-800">
                      {li.description}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {formatCurrency(li.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Photos */}
        {estimate.photos.length > 0 && (
          <section className="mt-6">
            <h2 className="border-b border-slate-300 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Site Photos
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {estimate.photos.map((p) => (
                <figure key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.path}
                    alt={p.caption ?? ""}
                    className="h-28 w-full border border-slate-200 object-cover"
                  />
                  {p.caption && (
                    <figcaption className="mt-1 text-[10px] text-slate-500">
                      {p.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Totals */}
        <section className="mt-6 flex justify-end">
          <div className="w-56 text-[13px]">
            <div className="flex justify-between py-0.5 text-slate-600">
              <span>Materials</span>
              <span className="tabular-nums">{formatCurrency(materials)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-slate-600">
              <span>Labor</span>
              <span className="tabular-nums">{formatCurrency(labor)}</span>
            </div>
            {extrasTotal > 0 && (
              <div className="flex justify-between py-0.5 text-slate-600">
                <span>Extras</span>
                <span className="tabular-nums">{formatCurrency(extrasTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 py-1 font-medium">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(estimate.subtotal)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-slate-600">
              <span>Tax</span>
              <span className="tabular-nums">{formatCurrency(estimate.taxAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-slate-800 py-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(estimate.total)}</span>
            </div>
          </div>
        </section>

        {estimate.notes && (
          <section className="mt-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Notes
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-700">
              {estimate.notes}
            </p>
          </section>
        )}

        {/* Terms */}
        <section className="mt-6 border-t border-slate-200 pt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Terms & Conditions
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
            {settings.termsAndConditions}
          </p>
        </section>

        {/* Signature */}
        <section className="mt-8 grid grid-cols-2 gap-10 text-[12px]">
          <div>
            <div className="mb-8 border-b border-slate-400" />
            <div className="text-slate-600">Customer signature / date</div>
          </div>
          <div>
            <div className="mb-8 border-b border-slate-400" />
            <div className="text-slate-600">Contractor signature / date</div>
          </div>
        </section>

        <footer className="mt-8 text-center text-[10px] text-slate-400">
          Prepared with PainterApps Pro · {settings.companyName}
        </footer>
      </article>
    </div>
  );
}
