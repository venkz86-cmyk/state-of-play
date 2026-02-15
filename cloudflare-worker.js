/**
 * Cloudflare Worker for The State of Play
 * Intercepts social media bot traffic and serves dynamic OG meta tags
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to Cloudflare Dashboard > Workers & Pages > Create Worker
 * 2. Paste this code
 * 3. Deploy the worker
 * 4. Go to your domain > Workers Routes
 * 5. Add route: stateofplay.club/* -> select your worker
 * 6. Add route: www.stateofplay.club/* -> select your worker
 */

// Your Render backend URL
const BACKEND_URL = 'https://stateofplay-backend.onrender.com';

// Bot patterns to detect social media crawlers
const BOT_PATTERNS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'slackbot',
  'telegrambot',
  'discordbot',
  'pinterest',
  'googlebot',
  'bingbot',
  'yandex',
  'baiduspider',
  'duckduckbot'
];

// Paths that should never be intercepted (static assets, API calls)
const BYPASS_PATHS = [
  '/api/',
  '/static/',
  '/content/',
  '/favicon',
  '/manifest',
  '/robots.txt',
  '/sitemap',
  '/_next/',
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf'
];

// Pages that are NOT articles (should use default OG tags)
const NON_ARTICLE_PATHS = [
  '/',
  '/about',
  '/contact',
  '/signup',
  '/login',
  '/account',
  '/welcome',
  '/the-left-field',
  '/the-outfield',
  '/state-of-play'
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
    
    // Check if this is a bot
    const isBot = BOT_PATTERNS.some(bot => userAgent.includes(bot));
    
    // If not a bot, pass through to origin
    if (!isBot) {
      return fetch(request);
    }
    
    // Check if path should be bypassed
    const shouldBypass = BYPASS_PATHS.some(bypass => path.includes(bypass));
    if (shouldBypass) {
      return fetch(request);
    }
    
    // Check if this is a non-article page
    const isNonArticle = NON_ARTICLE_PATHS.some(nonArticle => {
      if (nonArticle === '/') {
        return path === '/' || path === '';
      }
      return path.startsWith(nonArticle);
    });
    
    if (isNonArticle) {
      // For non-article pages, pass through to origin (will use static OG tags)
      return fetch(request);
    }
    
    // This looks like an article slug - fetch OG meta from backend
    const slug = path.replace(/^\//, '').replace(/\/$/, '');
    
    if (!slug) {
      return fetch(request);
    }
    
    try {
      // Call the backend OG endpoint
      const ogResponse = await fetch(`${BACKEND_URL}/api/og/${slug}`, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html'
        }
      });
      
      if (ogResponse.ok) {
        const html = await ogResponse.text();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        });
      }
      
      // If backend fails, pass through to origin
      return fetch(request);
      
    } catch (error) {
      console.error('Worker error:', error);
      // On any error, pass through to origin
      return fetch(request);
    }
  }
};
