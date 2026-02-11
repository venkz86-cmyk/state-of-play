// Ghost API configuration
const GHOST_URL = 'https://the-state-of-play.ghost.io';
const GHOST_CONTENT_API_KEY = '03dfda5a2d0c082e9c47c08b0b';

// Bot detection patterns for social media crawlers
const BOT_PATTERNS = [
  'WhatsApp',
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'Pinterest',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_PATTERNS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req, res) {
  const { slug } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  
  // If not a bot, redirect to the actual page
  if (!isBot(userAgent)) {
    return res.redirect(301, `/${slug}`);
  }

  try {
    // Fetch article data from Ghost
    const ghostResponse = await fetch(
      `${GHOST_URL}/ghost/api/content/posts/slug/${slug}/?key=${GHOST_CONTENT_API_KEY}&include=authors`
    );

    if (!ghostResponse.ok) {
      return res.redirect(301, `/${slug}`);
    }

    const data = await ghostResponse.json();
    const article = data.posts?.[0];

    if (!article) {
      return res.redirect(301, `/${slug}`);
    }

    // Generate meta tags HTML
    const title = article.title || 'The State of Play';
    const description = article.excerpt || article.custom_excerpt || "India's premium sports business publication";
    const image = article.feature_image || 'https://the-state-of-play.ghost.io/content/images/size/w1200/2024/01/default-og.jpg';
    const articleUrl = `https://www.stateofplay.club/${slug}`;
    const author = article.primary_author?.name || 'The State of Play';
    const publishedTime = article.published_at || new Date().toISOString();

    // Return HTML with proper Open Graph tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)} | The State of Play</title>
  <meta name="title" content="${escapeHtml(title)} | The State of Play">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(author)}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="The State of Play">
  <meta property="article:published_time" content="${publishedTime}">
  <meta property="article:author" content="${escapeHtml(author)}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${articleUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${articleUrl}">Read the full article</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(html);

  } catch (error) {
    console.error('Error fetching article:', error);
    return res.redirect(301, `/${slug}`);
  }
}
