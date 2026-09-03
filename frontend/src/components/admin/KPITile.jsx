import { Overline } from '../MockupLayout';

// Extracted from TeamsManage.js's inline stat-grid (its `[label, value,
// accent]` tuple rendered inline, SECTION B) into a real, reusable tile.
// Usage: wrap a row of these in a `border-y border-[var(--rule)] grid
// grid-cols-2 md:grid-cols-4` container, same as TeamsManage.js does --
// the border-left-between-cells effect needs the caller to pass
// `bordered` on every tile after the first in its row.
export const KPITile = ({ label, value, sublabel, accent = false, bordered = false }) => (
  <div className={`py-6 px-6 ${bordered ? 'md:border-l border-[var(--rule)]' : ''}`}>
    <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">{label}</Overline>
    <p
      className="font-editorial font-medium text-lg lg:text-xl leading-tight"
      style={{ color: accent ? 'var(--accent-burgundy)' : 'var(--text)' }}
    >
      {value}
    </p>
    {sublabel && (
      <p className="font-plex text-[12px] text-[var(--text-muted)] mt-1">{sublabel}</p>
    )}
  </div>
);

export default KPITile;
