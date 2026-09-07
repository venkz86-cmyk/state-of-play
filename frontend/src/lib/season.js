// Shared with HomeMockup.js's own dateline and ArticleMockup.js's dateline
// strip, so the two never show different "seasons" for the same edition
// count. 50 published stories = one season, computed live from the real
// edition number rather than a hand-maintained figure -- it rolls over on
// its own as the archive grows.
export const STORIES_PER_SEASON = 50;

const SEASON_WORDS = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
];

export const seasonLabel = (editionNo) => {
  const n = Math.max(1, Math.ceil((editionNo || 1) / STORIES_PER_SEASON));
  return SEASON_WORDS[n - 1] || String(n);
};
