import { useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import { KPITile } from './KPITile';
import { adminFetch, AdminAuthError } from '../../lib/adminFetch';
import { formatDateTime, daysUntil } from '../../lib/format';

const TYPE_LABEL = { cold: 'Cold link', gift: 'Gift link' };
const FILTERS = ['all', 'cold', 'gift'];

// The audit trail nothing in this codebase had before: every cold/gift
// link ever minted, who made it, whether it's been opened. Link creation
// itself stays where it already is -- POST /api/cold-link/generate (the
// in-article ColdLinkAdminButton) and the gift modal readers use -- this
// is a history view, not a new way to make links.
export const LinksPanel = ({ onAuthError }) => {
  const [filter, setFilter] = useState('all');
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const load = async (linkType) => {
    try {
      const data = await adminFetch(`/api/admin/links?link_type=${linkType}`);
      setLinks(data.links);
    } catch (e) {
      if (e instanceof AdminAuthError) { onAuthError?.(); return; }
      setError(e.message || 'Could not load links.');
    }
  };

  useEffect(() => { setLinks(null); load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.token_id);
      setTimeout(() => setCopiedId(''), 2000);
    } catch (_e) {
      setError('Could not copy to clipboard.');
    }
  };

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!links) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>;
  }

  const openedCount = links.filter((l) => l.open_count > 0).length;

  const columns = [
    { key: 'token_type', label: 'Type', sortable: true, render: (l) => TYPE_LABEL[l.token_type] || l.token_type },
    { key: 'post_slug', label: 'Story', sortable: true },
    { key: 'created_by', label: 'Created by', sortable: true, render: (l) => l.subscriber_name || l.created_by || '—' },
    { key: 'created_at', label: 'Created', sortable: true, render: (l) => formatDateTime(l.created_at) },
    {
      key: 'expires_at', label: 'Expires', sortable: true, align: 'right',
      render: (l) => {
        if (l.status !== 'active') return <span style={{ color: 'var(--text-muted)' }}>{l.status}</span>;
        const d = daysUntil(l.expires_at);
        return d != null && d < 0
          ? <span style={{ color: 'var(--accent-burgundy)' }}>expired</span>
          : (d != null ? `${d}d left` : '—');
      },
    },
    { key: 'open_count', label: 'Opens', sortable: true, align: 'right' },
    {
      key: 'actions', label: '', align: 'right',
      render: (l) => (
        <button
          type="button"
          onClick={() => copy(l)}
          className="font-plex text-[12px] uppercase tracking-[0.05em] text-[var(--accent-burgundy)] hover:underline underline-offset-4"
        >
          {copiedId === l.token_id ? 'Copied' : 'Copy link'}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-6">
        <KPITile label={`${filter === 'all' ? 'Total' : TYPE_LABEL[filter]} links`} value={links.length} />
        <KPITile label="Opened at least once" value={openedCount} bordered />
      </div>

      <div className="flex gap-6 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`font-plex text-[13px] pb-1 border-b-2 capitalize transition-colors ${
              filter === f
                ? 'border-[var(--accent-burgundy)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f === 'all' ? 'All' : TYPE_LABEL[f]}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={links}
        rowKey={(l) => l.token_id}
        searchKeys={['post_slug', 'created_by', 'subscriber_name']}
        searchPlaceholder="Search by story or creator…"
        emptyMessage="No links minted yet."
      />
    </div>
  );
};

export default LinksPanel;
