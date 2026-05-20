/**
 * Card-shaped skeleton matching SlideCard geometry. Used as a Suspense
 * fallback on the slides page so first paint shows the grid silhouette
 * instead of a generic spinner.
 */
export function SlideGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-64 rounded-lg bg-navy/5 animate-pulse" />
        <div className="h-10 w-56 rounded-lg bg-navy/5 animate-pulse" />
        <div className="ml-auto h-10 w-32 rounded-lg bg-rust/20 animate-pulse" />
      </div>
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, 240px)' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-cream overflow-hidden"
            style={{ width: 240 }}
          >
            <div
              className="bg-navy/5 animate-pulse"
              style={{ width: 240, height: 240 * (1920 / 1080) }}
            />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-navy/10 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-navy/5 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-navy/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
