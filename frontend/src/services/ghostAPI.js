import axios from 'axios';

const GHOST_URL = process.env.REACT_APP_GHOST_URL;
const GHOST_CONTENT_KEY = process.env.REACT_APP_GHOST_CONTENT_API_KEY;

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

      const response = await axios.get(`${this.contentURL}/posts/slug/${slug}/?${params}`);
      return this.transformPost(response.data.posts[0]);
    } catch (error) {
      console.error('Ghost API Error:', error);
      return null;
    }
  }

  // Transform Ghost post to our format
  transformPost(post) {
    if (!post) return null;

    return {
      id: post.slug,
      title: post.title,
      subtitle: post.custom_excerpt || post.excerpt,
      content: post.html,
      preview_content: post.excerpt || post.custom_excerpt || '',
      author: post.primary_author?.name || 'The State of Play',
      publication: this.getPublicationType(post),
      is_premium: post.visibility === 'paid' || post.visibility === 'members',
      theme: post.primary_tag?.name || 'Sports Business',
      image_url: post.feature_image,
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
