/* The indicator above a story's headline: what kind of piece it is, and
   a mark on free stories. The format is set per story in Ghost with an
   internal tag such as #format-analysis (Reportage when none is set).
   Free stories are the exception, so they get the colour: a filled
   burgundy pill ("Free to read"), or a burgundy outline when the reader
   has to sign up first. Paywalled stories are the default, so their mark
   is quiet grey text, shown only to readers who would hit the paywall
   (visitors and free members); paying members and readers on The Ten
   see none. Topics are tags for the archive, not part of this line. */
import { useAuth } from '../contexts/AuthContext';

const freeText = (post) => (post.requires_registration ? 'Free with sign-up' : 'Free to read');

const pill = 'inline-block font-plex text-[11px] font-medium rounded-full px-2 py-[1px] leading-[1.4] border border-[var(--accent-burgundy)]';

export const FreeMark = ({ children = 'Free', signUp = false, className = '' }) => (
  <span
    className={`${pill} ${signUp ? 'text-[var(--accent-ink)]' : 'bg-[var(--accent-burgundy)] text-white'} ${className}`}
    data-testid={signUp ? 'free-signup-mark' : 'free-mark'}
  >
    {children}
  </span>
);

export const PaywallMark = ({ className = '' }) => (
  <span className={`inline-block font-plex text-[11px] text-[var(--text-label)] ${className}`} data-testid="paywall-mark">
    For subscribers
  </span>
);

export const StoryLabel = ({ post, small = false, showAccess = true, as: Tag = 'p', className = '' }) => {
  const { user, loading } = useAuth();
  if (!post) return null;
  const subscriber = !!user?.is_paid || user?.tier === 'trial';
  // A members-only story is free to anyone signed in: no mark once they are.
  const free = showAccess && (!post.is_premium || (post.requires_registration && !user));
  // Not shown while sign-in is still being checked, so members never see
  // it flash on and off.
  const paywalled = showAccess && !loading && post.is_premium && !post.requires_registration && !subscriber;
  return (
    <Tag className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 font-plex ${className}`} data-testid="story-label">
      <span className={`${small ? 'text-[11px]' : 'text-[12px]'} uppercase tracking-[0.1em] font-semibold text-[var(--accent-ink)]`}>
        {post.format || 'Reportage'}
      </span>
      {free && <FreeMark signUp={!!post.requires_registration}>{freeText(post)}</FreeMark>}
      {paywalled && <PaywallMark />}
    </Tag>
  );
};

/* The Left Field is its own publication: its name set as a name, with
   the same free mark as a story. */
export const LeftFieldMark = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-2 ${className}`} data-testid="left-field-mark">
    <span className="font-editorial text-[17px] leading-none text-[var(--text)]">The Left Field</span>
    <FreeMark />
  </span>
);

export default StoryLabel;
