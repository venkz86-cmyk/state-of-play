import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

class SubstackAPI {
  constructor() {
    this.feedURL = 'http://theleftfield.substack.com/feed';
  }

  async getPosts(limit = 15) {
    try {
      // Use a CORS proxy since we're calling from browser
      const response = await axios.get(this.feedURL);
      const parsed = await parseXML(response.data);
      
      const items = parsed.rss.channel[0].item || [];
      
      return items.slice(0, limit).map(item => this.transformPost(item));
    } catch (error) {
      console.error('Substack RSS Error:', error);
      return [];
    }
  }

  transformPost(item) {
    // Extract data from RSS item
    const title = item.title?.[0] || '';
    const link = item.link?.[0] || '';
    const pubDate = item.pubDate?.[0] || new Date().toISOString();
    const description = item.description?.[0] || item['content:encoded']?.[0] || '';
    const creator = item['dc:creator']?.[0] || 'The Left Field';
    
    // Extract image from content if present
    const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    
    // Clean description (remove HTML)
    const cleanDescription = description.replace(/<[^>]*>/g, '').substring(0, 200);
    
    // Extract slug from URL
    const slug = link.split('/').pop() || title.toLowerCase().replace(/\s+/g, '-');

    return {
      id: slug,
      title: title,
      subtitle: cleanDescription,
      content: description,
      preview_content: cleanDescription,
      author: creator,
      publication: 'The Left Field',
      is_premium: false,
      theme: 'The Left Field',
      image_url: imageUrl,
      read_time: 5,
      created_at: pubDate,
      updated_at: pubDate,
      slug: slug,
      external_url: link
    };
  }
}

export const substackAPI = new SubstackAPI();
