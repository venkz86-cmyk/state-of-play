import { useEffect } from 'react';

/**
 * Centralised SEO + OpenGraph + JSON-LD wrapper.
 *
 * Manages document.title, meta, canonical, and JSON-LD imperatively via
 * document.head. We deliberately do NOT use react-helmet-async because the
 * project's visual-edits babel transform interferes with Helmet's
 * Children.only traversal and its prop-based API isn't stable in v2.
 *
 * Each invocation tracks the elements it created and removes them on
 * unmount, so route changes do not leave stale tags behind.
 */

const ATTR = 'data-tsop-seo';

const upsertMeta = (key, keyName, content, createdNodes) => {
  const selector = `meta[${keyName}="${key}"]`;
  // First try to update an existing tag (e.g. the static one in index.html).
  // If it has no ATTR yet, claim ownership so we can clean up on unmount.
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(keyName, key);
    document.head.appendChild(el);
    el.setAttribute(ATTR, '1');
    createdNodes.push(el);
  } else if (!el.hasAttribute(ATTR)) {
    // Don't track for removal — we won't remove the static index.html tag,
    // we'll just update its content for this route.
  }
  el.setAttribute('content', content);
  return el;
};

const upsertLink = (rel, href, createdNodes) => {
  const selector = `link[rel="${rel}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
    el.setAttribute(ATTR, '1');
    createdNodes.push(el);
  }
  el.setAttribute('href', href);
  return el;
};

const upsertJsonLd = (json, createdNodes) => {
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.setAttribute(ATTR, '1');
  el.textContent = JSON.stringify(json);
  document.head.appendChild(el);
  createdNodes.push(el);
  return el;
};

export const SEO = ({
  title,
  description,
  path = '',
  image,
  type = 'website',
  article = null,
  noindex = false,
}) => {
  const SITE = 'https://www.stateofplay.club';
  const fullTitle = title
    ? title + ' | The State of Play'
    : 'The State of Play | Sports Business Intelligence';
  const desc =
    description ||
    "India's sports business publication. Reportage, analysis, and intelligence from sport's most consequential rooms.";
  const url = SITE + (path.startsWith('/') ? path : '/' + path);
  const ogImage = image || (SITE + '/og-default.png');
  const ogTitle = title || 'The State of Play';

  useEffect(() => {
    const prevTitle = document.title;
    document.title = fullTitle;

    const created = [];

    upsertMeta('description', 'name', desc, created);
    upsertLink('canonical', url, created);

    // Open Graph
    upsertMeta('og:type', 'property', type, created);
    upsertMeta('og:site_name', 'property', 'The State of Play', created);
    upsertMeta('og:url', 'property', url, created);
    upsertMeta('og:title', 'property', ogTitle, created);
    upsertMeta('og:description', 'property', desc, created);
    upsertMeta('og:image', 'property', ogImage, created);
    upsertMeta('og:image:width', 'property', '1200', created);
    upsertMeta('og:image:height', 'property', '630', created);

    // Twitter
    upsertMeta('twitter:card', 'name', 'summary_large_image', created);
    upsertMeta('twitter:title', 'name', ogTitle, created);
    upsertMeta('twitter:description', 'name', desc, created);
    upsertMeta('twitter:image', 'name', ogImage, created);

    if (noindex) {
      upsertMeta('robots', 'name', 'noindex', created);
    }

    if (article) {
      const published = article.created_at || article.published_at || '';
      if (published) {
        upsertMeta('article:published_time', 'property', published, created);
      }
      if (article.author) {
        upsertMeta('article:author', 'property', article.author, created);
      }
    }

    // JSON-LD
    const ldJson = article
      ? {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: article.title,
          description: article.subtitle || article.excerpt || desc,
          image: [article.image_url || ogImage],
          datePublished: article.created_at || article.published_at,
          dateModified: article.updated_at || article.created_at,
          author: {
            '@type': 'Person',
            name: article.author || 'Venkat Ananth',
            url: SITE + '/about',
          },
          publisher: {
            '@type': 'Organization',
            name: 'The State of Play',
            logo: { '@type': 'ImageObject', url: SITE + '/logo512.png' },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          isAccessibleForFree: !article.is_premium,
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'The State of Play',
          url: SITE,
          potentialAction: {
            '@type': 'SearchAction',
            target: SITE + '/archive?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        };
    upsertJsonLd(ldJson, created);

    return () => {
      document.title = prevTitle;
      created.forEach((el) => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    };
  }, [
    fullTitle,
    desc,
    url,
    ogImage,
    ogTitle,
    type,
    noindex,
    article,
  ]);

  return null;
};

export default SEO;
