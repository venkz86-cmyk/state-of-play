export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  
  if (!slug) {
    return Response.redirect('https://www.stateofplay.club/', 302);
  }
  
  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest/i.test(userAgent);
  
  // For regular users, redirect to the article
  if (!isCrawler) {
    return Response.redirect(`https://www.stateofplay.club/${slug}`, 302);
  }
  
  // For crawlers, fetch OG data from backend
  try {
    const response = await fetch(`https://state-of-play-backend.onrender.com/api/og/${slug}`);
    const html = await response.text();
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return Response.redirect(`https://www.stateofplay.club/${slug}`, 302);
  }
}
