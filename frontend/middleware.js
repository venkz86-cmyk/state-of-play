import { NextResponse } from 'next/server';

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
  'Googlebot',
  'bingbot',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_PATTERNS.some(bot => userAgent.includes(bot));
}

export async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only intercept for bots on article pages (not home, about, etc.)
  const excludedPaths = ['/', '/about', '/contact', '/login', '/signup', '/membership', '/archive', '/state-of-play', '/left-field', '/outfield'];
  const isArticlePage = !excludedPaths.includes(pathname) && pathname !== '/favicon.ico' && !pathname.startsWith('/static') && !pathname.startsWith('/content') && !pathname.startsWith('/api');

  if (isBot(userAgent) && isArticlePage) {
    try {
      // Extract slug from pathname
      const slug = pathname.replace('/', '');
      
      // Fetch article data from Ghost
      const ghostResponse = await fetch(
        `${GHOST_URL}/ghost/api/content/posts/slug/${slug}/?key=${GHOST_CONTENT_API_KEY}&include=authors`
      );

      if (ghostResponse.ok) {
        const data = await ghostResponse.json();
        const article = data.posts?.[0];

        if (article) {
          // Generate meta tags HTML
          const title = article.title || 'The State of Play';
          const description = article.excerpt || article.custom_excerpt || 'India\'s premium sports business publication';
          const image = article.feature_image || 'https://the-state-of-play.ghost.io/content/images/2024/01/default-og-image.jpg';
          const articleUrl = `https://www.stateofplay.club${pathname}`;
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
  
  <!-- Open Graph / Facebook -->
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
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${articleUrl}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${image}">
  
  <!-- Redirect real users to the actual page -->
  <meta http-equiv="refresh" content="0;url=${articleUrl}">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>Redirecting to <a href="${articleUrl}">${articleUrl}</a>...</p>
</body>
</html>`;

          return new NextResponse(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    } catch (error) {
      console.error('Middleware error:', error);
    }
  }

  return NextResponse.next();
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

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|content|static|api).*)',
  ],
};
