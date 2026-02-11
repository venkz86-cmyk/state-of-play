const BACKEND_URL = 'https://state-of-play-backend.onrender.com';

const SKIP_PATHS = [
  '/',
  '/login',
  '/signup', 
  '/about',
  '/contact',
  '/account',
  '/membership',
  '/archive',
  '/terms',
  '/privacy',
  '/state-of-play',
  '/left-field',
  '/outfield'
];

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Skip static files, API routes, and known pages
  if (
    SKIP_PATHS.includes(pathname) ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/content') ||
    pathname.includes('.')
  ) {
    return;
  }
  
  const userAgent = request.headers.get('user-agent') || '';
  
  // Detect social media crawlers
  const crawlerPatterns = [
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
    'bingbot'
  ];
  
  const isCrawler = crawlerPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (isCrawler) {
    const slug = pathname.replace(/^\//, '');
    
    try {
      const ogResponse = await fetch(`${BACKEND_URL}/api/og/${slug}`);
      
      if (ogResponse.ok) {
        const html = await ogResponse.text();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    } catch (e) {
      // Fall through to default handling
    }
  }
  
  // For regular users, continue to React app
  return;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|content|static|api).*)']
};
