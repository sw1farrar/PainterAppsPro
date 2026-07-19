export default function Loading() {
  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div>
          <h1 className="text-base font-semibold">Estimates</h1>
          <p className="text-[11px] text-muted-foreground">
            Draft, send, and track proposals
          </p>
        </div>
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
      </header>
      <div className="flex gap-1 border-b border-border bg-card px-4 py-2">
        {["All", "Draft", "Sent", "Accepted", "Declined"].map((label) => (
          <span
            key={label}
            className="rounded-sm bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground/50"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="p-4">
        <div className="panel overflow-hidden">
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border px-3 py-3 last:border-b-0"
              >
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
