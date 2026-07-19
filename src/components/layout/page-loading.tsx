export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div className="space-y-1.5">
          <div className="h-4 w-28 animate-pulse rounded-sm bg-muted" />
          <div className="h-2.5 w-40 animate-pulse rounded-sm bg-muted/70" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-sm bg-muted" />
      </header>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="panel h-[72px] animate-pulse bg-muted/40"
            />
          ))}
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-border bg-muted/50 px-3 py-2">
            <span className="text-[11px] text-muted-foreground">{label}…</span>
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-sm bg-muted/60"
                style={{ opacity: 1 - i * 0.08 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
