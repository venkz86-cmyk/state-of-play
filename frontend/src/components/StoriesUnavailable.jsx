// Shown when the stories couldn't be fetched (Ghost unreachable, a dropped
// connection). The publication always has stories, so an empty list after
// loading means the request failed, not that there's nothing to show.
export const StoriesUnavailable = ({ onRetry }) => (
  <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 text-center" data-testid="stories-unavailable" role="alert">
    <p className="font-editorial text-2xl lg:text-3xl mb-3">We couldn’t load the stories just now.</p>
    <p className="font-plex text-[15px] text-[var(--text-muted)] mb-8">It’s usually a dropped connection. Try again in a moment.</p>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-11 px-6 transition-colors"
      style={{ borderRadius: 'var(--control-radius)' }}
    >
      Try again
    </button>
  </div>
);

// Placeholder blocks while stories load, in the shape of the page's lead
// story and grid, so the header and footer don't jump in afterwards.
export const StoriesSkeleton = () => (
  <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 motion-safe:animate-pulse" aria-busy="true" aria-label="Loading stories">
    <div className="grid lg:grid-cols-[2fr_1fr] gap-10">
      <div>
        <div className="aspect-[16/10] bg-[var(--rule)] mb-6" />
        <div className="h-8 w-3/4 bg-[var(--rule)] mb-3" />
        <div className="h-4 w-1/2 bg-[var(--rule)]" />
      </div>
      <div className="hidden lg:block space-y-6">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-[var(--rule)]" />)}
      </div>
    </div>
    <div className="grid sm:grid-cols-3 gap-8 mt-14">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="h-5 w-5/6 bg-[var(--rule)] mb-2" />
          <div className="h-4 w-2/3 bg-[var(--rule)]" />
        </div>
      ))}
    </div>
  </div>
);
