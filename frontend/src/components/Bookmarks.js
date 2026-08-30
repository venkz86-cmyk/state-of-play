const STORAGE_KEY = 'tsop_bookmarks';
const MAX_BOOKMARKS = 200;

// Per-browser saved articles — deliberate ("I want to read/reference this
// again"), distinct from ReadingHistory.js which tracks passive views.
// Used by the "Saved" section on the Account page and the bookmark toggle
// on the article page.
export const getBookmarks = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const isBookmarked = (id) => {
  if (!id) return false;
  return getBookmarks().some((item) => item.id === id);
};

const save = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_BOOKMARKS)));
  } catch {
    /* storage unavailable — silent, matches ReadingHistory's fail-open */
  }
};

export const addBookmark = (article) => {
  if (!article || !article.id) return;
  const existing = getBookmarks();
  if (existing.some((item) => item.id === article.id)) return;
  save([
    {
      id: article.id,
      title: article.title,
      theme: article.theme,
      read_time: article.read_time,
      image_url: article.image_url,
      is_premium: article.is_premium,
      timestamp: Date.now(),
    },
    ...existing,
  ]);
};

export const removeBookmark = (id) => {
  save(getBookmarks().filter((item) => item.id !== id));
};

// Returns the new bookmarked state (true = now saved).
export const toggleBookmark = (article) => {
  if (!article || !article.id) return false;
  if (isBookmarked(article.id)) {
    removeBookmark(article.id);
    return false;
  }
  addBookmark(article);
  return true;
};

export const clearBookmarks = () => {
  localStorage.removeItem(STORAGE_KEY);
};
