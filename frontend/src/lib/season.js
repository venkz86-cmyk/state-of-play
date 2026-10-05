// Shared with HomeMockup.js's own dateline and ArticleMockup.js's dateline
// strip, so the two never show different "seasons" for the same edition
// count. 50 published stories = one season, computed live from the real
// edition number rather than a hand-maintained figure -- it rolls over on
// its own as the archive grows.
export const STORIES_PER_SEASON = 50;

// Posts that aren't season stories: the launch welcome note, plus anything
// Venkat tags "#not-season" in Ghost (slug "hash-not-season"). They stay in
// the archive; they just don't take a number or a place in the season.
export const NOT_SEASON_SLUGS = ['welcome-to-the-state-of-play'];
export const NOT_SEASON_TAG = 'hash-not-season';
export const isSeasonStory = (post) =>
  !NOT_SEASON_SLUGS.includes(post.slug || post.id) && !(post.tag_slugs || []).includes(NOT_SEASON_TAG);
// Ghost filter matching exactly the posts isSeasonStory leaves out.
export const NOT_SEASON_FILTER = `slug:[${NOT_SEASON_SLUGS.join(',')}],tag:${NOT_SEASON_TAG}`;

const SEASON_WORDS = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
];

export const seasonLabel = (editionNo) => {
  const n = Math.max(1, Math.ceil((editionNo || 1) / STORIES_PER_SEASON));
  return SEASON_WORDS[n - 1] || String(n);
};
