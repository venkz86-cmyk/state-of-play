import { useMemo, useState } from 'react';

/**
 * The one reusable table every admin dashboard panel is built on. No
 * dependency added for this -- a plain <table>, client-side search/sort/
 * pagination, sized for the hundreds-of-rows dataset an internal,
 * single-admin tool actually has (see the plan's stated assumption).
 *
 * columns: [{ key, label, sortable, align: 'left'|'right', render(row) }]
 * rows: plain objects. row[column.key] is shown unless `render` is given.
 * rowKey(row): stable key, defaults to JSON.stringify(row) if omitted.
 * searchKeys: which row fields the search box filters against (string
 *   fields only -- render()-only computed columns aren't searchable).
 */
export const DataTable = ({
  columns,
  rows,
  rowKey,
  searchKeys = [],
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing here yet.',
  onRowClick,
  pageSize = 50,
}) => {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim() || searchKeys.length === 0) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  const onSort = (col) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
    setPage(0);
  };

  return (
    <div data-testid="admin-data-table">
      {searchKeys.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            data-testid="admin-data-table-search"
            className="w-full max-w-[360px] bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[14px] py-2 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)]"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col)}
                  className={`font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] border-b border-[var(--rule)] py-3 px-3 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--text)]' : ''}`}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="font-plex text-[14px] text-[var(--text-muted)] py-10 text-center">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={rowKey ? rowKey(row) : JSON.stringify(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`font-plex text-[14px] border-b border-[var(--rule)]/50 ${
                    onRowClick ? 'cursor-pointer hover:bg-[var(--rule)]/20' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-3 ${col.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-4 font-plex text-[13px] text-[var(--text-muted)]">
          <span>
            {sorted.length} row{sorted.length === 1 ? '' : 's'} · page {clampedPage + 1} of {pageCount}
          </span>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              className="underline underline-offset-4 hover:text-[var(--accent-burgundy)] disabled:opacity-40 disabled:no-underline"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={clampedPage >= pageCount - 1}
              className="underline underline-offset-4 hover:text-[var(--accent-burgundy)] disabled:opacity-40 disabled:no-underline"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
