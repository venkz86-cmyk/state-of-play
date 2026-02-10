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
      
      if (!response.data || !response.data.posts || response.data.posts.length === 0) {
        console.error('No post found for slug:', slug);
        return null;
      }
      
      return this.transformPost(response.data.posts[0]);
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
      previewContent = parts[0]; // Content before paywall
      fullContent = parts.join(''); // Remove marker for full content
    } else {
      // If no <!--more--> marker, use first few paragraphs as preview
      // Extract first 2-3 paragraphs (roughly 300-500 chars of actual content)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = fullContent;
      const paragraphs = Array.from(tempDiv.querySelectorAll('p'));\n      \n      if (paragraphs.length > 0) {\n        // Take first 2-3 paragraphs\n        const previewParas = paragraphs.slice(0, 3);\n        previewContent = previewParas.map(p => p.outerHTML).join('');\n      } else {\n        // Fallback: use excerpt if no paragraphs found\n        previewContent = `<p>${post.excerpt || post.custom_excerpt || ''}</p>`;\n      }\n    }

    return {\n      id: post.slug,\n      title: post.title,\n      subtitle: post.custom_excerpt || post.excerpt,\n      content: fullContent,\n      preview_content: previewContent,\n      author: authorName,\n      publication: this.getPublicationType(post),\n      is_premium: post.visibility === 'paid' || post.visibility === 'members',\n      theme: post.primary_tag?.name || post.tags?.[0]?.name || 'Sports Business',\n      image_url: post.feature_image,\n      read_time: post.reading_time || 5,\n      created_at: post.published_at,\n      updated_at: post.updated_at,\n      slug: post.slug\n    };\n  }

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
