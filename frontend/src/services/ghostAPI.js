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

      const response = await axios.get(`${this.contentURL}/posts/?${params}`);
      return this.transformPosts(response.data.posts);
    } catch (error) {
      console.error('Ghost API Error:', error);
      return [];
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
      }

      // Fallback: fetch from list with slug filter (gets metadata for paid posts)
      const listParams = new URLSearchParams({
        key: GHOST_CONTENT_KEY,
        include: 'tags,authors',
        filter: `slug:${slug}`
      });

      const listResponse = await axios.get(`${this.contentURL}/posts/?${listParams}`);
      
      if (listResponse.data?.posts?.length > 0) {
        const post = listResponse.data.posts[0];
        // For paid posts, html might be returned but we should still show paywall
        return this.transformPost(post);
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

    // Handle paywall content
    let fullContent = post.html || '';
    let previewContent = '';
    
    // Check if content has <!--more--> marker for paywall placement
    if (fullContent.includes('<!--more-->')) {
      const parts = fullContent.split('<!--more-->');
      previewContent = parts[0];
      fullContent = parts.join('');
    } else {
      // Extract first 2-3 paragraphs using regex
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
      is_premium: post.visibility === 'paid' || post.visibility === 'members',
      theme: post.primary_tag?.name || post.tags?.[0]?.name || 'Sports Business',
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
    // Check tags to determine publication
    const tags = post.tags?.map(t => t.name.toLowerCase()) || [];
    
    if (tags.includes('left-field') || tags.includes('leftfield')) {
      return 'The Left Field';
    }
    
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
}

export const ghostAPI = new GhostAPI();
