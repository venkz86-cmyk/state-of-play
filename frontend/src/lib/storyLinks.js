// "Also read" cards inside a story. In Ghost, Venkat pastes a
// stateofplay.club story address on a line of its own (or Ghost turns it
// into a bookmark card); the story page shows a card for that story in its
// place. A link inside a sentence stays a link.

const SITE = String.raw`https?:\/\/(?:www\.)?stateofplay\.club\/([a-z0-9][a-z0-9-]*)\/?(?:[?#][^"]*)?`;

// A paragraph holding nothing but one link to a site address.
const BARE_LINK = new RegExp(String.raw`<p>\s*<a\s[^>]*href="${SITE}"[^>]*>[^<]*<\/a>\s*<\/p>`, 'gi');
// Ghost's own bookmark card, when it points at the site.
const BOOKMARK = new RegExp(String.raw`<figure class="kg-card kg-bookmark-card[^"]*">\s*<a class="kg-bookmark-container" href="${SITE}">[\s\S]*?<\/figure>`, 'gi');

/* Splits story HTML into [{ html }] and [{ slugs, html }] segments, in
   order. Cards next to each other (only whitespace between) form one group.
   Each card segment keeps its original HTML, shown if a slug isn't a story. */
export const splitStoryLinks = (html) => {
  if (!html || !/stateofplay\.club\//i.test(html)) return [{ html: html || '' }];
  const hits = [];
  for (const re of [BARE_LINK, BOOKMARK]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html))) hits.push({ start: m.index, end: m.index + m[0].length, slug: m[1].toLowerCase(), html: m[0] });
  }
  if (!hits.length) return [{ html }];
  hits.sort((a, b) => a.start - b.start);
  const out = [];
  let at = 0;
  for (const h of hits) {
    const between = html.slice(at, h.start);
    const last = out[out.length - 1];
    if (last && last.slugs && !between.trim()) {
      last.slugs.push(h.slug); last.html += between + h.html;
    } else {
      if (between) out.push({ html: between });
      out.push({ slugs: [h.slug], html: h.html });
    }
    at = h.end;
  }
  if (at < html.length) out.push({ html: html.slice(at) });
  return out;
};
