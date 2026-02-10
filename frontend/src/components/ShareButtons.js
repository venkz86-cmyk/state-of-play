import { Twitter, Linkedin, Link2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export const ShareButtons = ({ title, url }) => {
  const shareUrl = url || window.location.href;
  const shareText = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(shareUrl);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-2">Share</span>
      
      <a
        href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 bg-foreground/5 hover:bg-foreground/10 transition-colors rounded-sm"
        title="Share on X/Twitter"
      >
        <Twitter className="h-4 w-4 text-foreground/70" />
      </a>
      
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 bg-foreground/5 hover:bg-foreground/10 transition-colors rounded-sm"
        title="Share on LinkedIn"
      >
        <Linkedin className="h-4 w-4 text-foreground/70" />
      </a>
      
      <a
        href={`https://wa.me/?text=${shareText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 bg-foreground/5 hover:bg-foreground/10 transition-colors rounded-sm"
        title="Share on WhatsApp"
      >
        <MessageCircle className="h-4 w-4 text-foreground/70" />
      </a>
      
      <button
        onClick={copyLink}
        className="p-2 bg-foreground/5 hover:bg-foreground/10 transition-colors rounded-sm"
        title="Copy link"
      >
        <Link2 className="h-4 w-4 text-foreground/70" />
      </button>
    </div>
  );
};
