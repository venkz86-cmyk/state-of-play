import { NextResponse } from 'next/server';

export const config = {
  matcher: '/:slug*',
};

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Skip static files and known routes
  const skipPaths = ['/', '/login', '/signup', '/about', '/contact', '/account', '/membership', '/archive', '/terms', '/privacy', '/state-of-play', '/left-field', '/outfield'];
  if (skipPaths.includes(pathname) || pathname.startsWith('/static') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Detect social media crawlers
  const isCrawler = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest/i.test(userAgent);
  
  if (isCrawler) {
    // Rewrite to backend OG endpoint
    const slug = pathname.replace(/^\//, '');
    return NextResponse.rewrite(`https://state-of-play-backend.onrender.com/api/og/${slug}`);
  }
  
  return NextResponse.next();
}
