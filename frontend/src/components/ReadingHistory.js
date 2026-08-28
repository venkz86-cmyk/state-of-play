const STORAGE_KEY = 'tsop_reading_history';
const MAX_HISTORY = 10;

// Per-browser reading history, keyed to nothing about the logged-in
// account. Used by the "Recently read" section on the Account page.
export const addToReadingHistory = (article) => {
  if (!article || !article.id) return;
  const history = getReadingHistory();

  // Remove if already exists
  const filtered = history.filter(item => item.id !== article.id);

  // Add to beginning
  const newHistory = [
    {
      id: article.id,
      title: article.title,
      theme: article.theme,
      read_time: article.read_time,
      image_url: article.image_url,
      is_premium: article.is_premium,
      timestamp: Date.now()
    },
    ...filtered
  ].slice(0, MAX_HISTORY);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
};

export const getReadingHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearReadingHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};
