import axios from 'axios';

const GHOST_URL = process.env.REACT_APP_GHOST_URL;
const GHOST_CONTENT_KEY = process.env.REACT_APP_GHOST_CONTENT_API_KEY;

// Fix image URLs - Ghost might return URLs with custom domain that don't resolve
// We need to transform them back to the Ghost CDN
const fixImageUrl = (url) => {
  if (!url) return url;
  // Replace custom domain with Ghost domain for images
  return url.replace('https://www.stateofplay.club/content/', `${GHOST_URL}/content/`)
            .replace('https://stateofplay.club/content/', `${GHOST_URL}/content/`);
};

class GhostAPI {
  constructor() {
    this.contentURL = `${GHOST_URL}/ghost/api/content`;
  }

  // Fetch posts with filters
  async getPosts(options = {}) {
    try {
      const params = new URLSearchParams({
        key: GHOST_CONTENT_KEY,
        limit: options.limit || 15,
        include: 'tags,authors',
        ...options.filters
      });
      if (options.page) params.set('page', options.page);

      const response = await axios.get(`${this.contentURL}/posts/?${params}`);
      return this.transformPosts(response.data.posts);
    } catch (error) {
      console.error('Ghost API Error:', error);
      return [];
    }
  }

  /**
   * Fetch every post in the publication, paginating through the Ghost
   * Content API in chunks of 50 (Ghost's hard limit per request).
   * Returns the merged list in published-desc order.
   */
  async getAllPosts() {
    const PER_PAGE = 50;
    const all = [];
    let page = 1;
    try {
      // Loop until Ghost reports no more pages.
      // Safety cap of 20 pages (=1000 posts) is plenty headroom.
      for (let i = 0; i < 20; i += 1) {
        const params = new URLSearchParams({
          key: GHOST_CONTENT_KEY,
          limit: PER_PAGE,
          include: 'tags,authors',
          page: String(page),
        });
        const resp = await axios.get(`${this.contentURL}/posts/?${params}`);
        const batch = this.transformPosts(resp.data.posts || []);
        all.push(...batch);
        const meta = resp.data?.meta?.pagination;
        if (!meta || page >= (meta.pages || 1)) break;
        page += 1;
      }
    } catch (error) {
      console.error('Ghost getAllPosts error:', error);
    }
    return all;
  }

  // Total post count — used for the dateline edition number ("No. X")
  async getPostCount() {
    try {
      const params = new URLSearchParams({
        key: GHOST_CONTENT_KEY,
        limit: 1,
        fields: 'id',
      });
      const response = await axios.get(`${this.contentURL}/posts/?${params}`);
      return response.data?.meta?.pagination?.total ?? 0;
    } catch (error) {
      console.error('Ghost post count error:', error);
      return 0;
    }
  }

  // Get single post by slug
  async getPost(slug) {
    try {
      const params = new URLSearchParams({
        key: GHOST_CONTENT_KEY,
        include: 'tags,authors'
      });

      // First try direct slug fetch (works for public posts)
      try {
        const response = await axios.get(`${this.contentURL}/posts/slug/${slug}/?${params}`);
        
        if (response.data?.posts?.length > 0) {
          return this.transformPost(response.data.posts[0]);
        }
      } catch (directError) {
        // Paid posts return 404 on direct fetch, continue to fallback
        console.log('Direct fetch failed, trying list fallback for:', slug);
      }

      // Fallback: fetch recent posts and find by slug (gets metadata for paid posts)
      const listParams = new URLSearchParams({
        key: GHOST_CONTENT_KEY,
        include: 'tags,authors',
        limit: 'all'
      });

      const listResponse = await axios.get(`${this.contentURL}/posts/?${listParams}`);
      
      if (listResponse.data?.posts) {
        const post = listResponse.data.posts.find(p => p.slug === slug);
        if (post) {
          return this.transformPost(post);
        }
      }

      console.error('No post found for slug:', slug);
      return null;
    } catch (error) {
      console.error('Ghost API Error fetching post:', error.message);
      return null;
    }
  }

  // Transform Ghost post to our format
  transformPost(post) {
    if (!post) return null;

    // Get author name
    const authorName = post.authors?.[0]?.name || post.primary_author?.name || 'The State of Play';

    // Check if this is a paid/members-only post
    const isPremium = post.visibility === 'paid' || post.visibility === 'members';

    // Get full content
    let fullContent = post.html || '';
    let previewContent = '';
    
    // Check if content has <!--more--> marker for paywall placement
    if (fullContent.includes('<!--more-->')) {
      const parts = fullContent.split('<!--more-->');
      previewContent = parts[0];
      fullContent = parts.join('');
    } else {
      // Extract first 2-3 paragraphs for preview
      const pTagMatches = fullContent.match(/<p[^>]*>.*?<\/p>/gs);
      
      if (pTagMatches && pTagMatches.length > 0) {
        previewContent = pTagMatches.slice(0, 3).join('');
      } else {
        previewContent = `<p>${post.excerpt || post.custom_excerpt || ''}</p>`;
      }
    }

    return {
      id: post.slug,
      title: post.title,
      subtitle: post.custom_excerpt || post.excerpt,
      content: fullContent,
      preview_content: previewContent,
      author: authorName,
      publication: this.getPublicationType(post),
      is_premium: isPremium,
      theme: post.primary_tag?.name || post.tags?.[0]?.name || 'Sports Business',
      primary_tag_slug: post.primary_tag?.slug || post.tags?.[0]?.slug || null,
      tag_slugs: (post.tags || []).map(t => t.slug).filter(Boolean),
      image_url: fixImageUrl(post.feature_image),
      image_caption: post.feature_image_caption,
      read_time: post.reading_time || 5,
      created_at: post.published_at,
      updated_at: post.updated_at,
      slug: post.slug
    };
  }

  transformPosts(posts) {
    return posts.map(post => this.transformPost(post));
  }

  getPublicationType(post) {
    // Check tags (both name and slug) to determine publication
    const tagTokens = (post.tags || [])
      .flatMap((t) => [t.name || '', t.slug || ''])
      .map((s) => s.toLowerCase().replace(/[\s-_]/g, ''));

    if (tagTokens.includes('leftfield')) return 'The Left Field';
    return 'The State of Play';
  }

  // Get posts by publication
  async getPostsByPublication(publication, limit = 15) {
    const tag = publication === 'The Left Field' ? 'left-field' : 'state-of-play';
    return this.getPosts({ 
      limit,
      filters: { filter: `tag:${tag}` }
    });
  }

  /**
   * Related posts strategy (in order of preference):
   *   1. Same primary tag, excluding the current post.
   *   2. Any overlapping tag (other than the broad publication tags), most recent first.
   *   3. Fallback to the most-recent posts, excluding the current post.
   * Returns up to `limit` items.
   */
  async getRelatedPosts(post, limit = 3) {
    if (!post) return [];
    const skipTags = new Set(['state-of-play', 'left-field', 'leftfield', 'public']);
    const meaningfulTags = (post.tag_slugs || []).filter((s) => s && !skipTags.has(s));
    const primary = post.primary_tag_slug && !skipTags.has(post.primary_tag_slug)
      ? post.primary_tag_slug
      : meaningfulTags[0] || null;

    const exclude = (list) => list.filter((p) => p.id !== post.id && p.slug !== post.slug);

    // 1. Same primary tag
    if (primary) {
      const sameTag = await this.getPosts({
        limit: limit + 3,
        filters: { filter: `tag:${primary}` },
      });
      const filtered = exclude(sameTag);
      if (filtered.length >= limit) return filtered.slice(0, limit);

      // 2. Any overlapping tag (excluding the primary one already tried)
      const otherTags = meaningfulTags.filter((t) => t !== primary);
      if (otherTags.length > 0) {
        const filterExpr = otherTags.map((t) => `tag:${t}`).join(',');
        const overlap = await this.getPosts({
          limit: limit + 3,
          filters: { filter: filterExpr },
        });
        const seen = new Set(filtered.map((p) => p.id));
        const merged = [
          ...filtered,
          ...exclude(overlap).filter((p) => !seen.has(p.id)),
        ];
        if (merged.length >= limit) return merged.slice(0, limit);
      }

      // 3. Top up with recent posts
      const recent = await this.getPosts({ limit: limit + 3 });
      const seen = new Set(filtered.map((p) => p.id));
      const merged = [
        ...filtered,
        ...exclude(recent).filter((p) => !seen.has(p.id)),
      ];
      return merged.slice(0, limit);
    }

    // No tag info at all → recent fallback
    const recent = await this.getPosts({ limit: limit + 1 });
    return exclude(recent).slice(0, limit);
  }
}

export const ghostAPI = new GhostAPI();
