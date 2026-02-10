# The State of Play

A premium custom frontend for The State of Play - India's leading sports business publication.

## 🌟 Features

### Reader Experience
- **Dark Mode** - Beautiful dark theme with automatic logo swap
- **Clean URLs** - SEO-friendly URLs (`/article-slug` not `/article/article-slug`)
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Font Size Toggle** - Adjustable reading size (80%-140%)
- **Reading Progress** - Visual progress bar at the top of articles
- **Social Sharing** - Share to Twitter, LinkedIn, WhatsApp, or copy link
- **Search** - Quick search with keyboard shortcut (⌘K)
- **Related Articles** - Discover more content at the end of each article
- **Reading History** - "Continue Reading" section tracks your recently viewed articles

### Membership & Paywall
- **Secure Paywall** - Premium content protected, preview shown to non-subscribers
- **Member Verification** - Login system with Ghost Admin API integration
- **PRO Badge** - Paid members see their status in the header
- **Razorpay Payments** - Geo-based pricing (₹3,000/year India, $49/year International)
- **Welcome Toast** - Personalized "Welcome back, [Name]!" on login

### Content
- **Ghost CMS Integration** - All content managed through Ghost
- **Dynamic Meta Tags** - Article titles and images appear when sharing on social media
- **Photo Captions** - Image credits displayed from Ghost
- **Archive Page** - Browse all articles
- **Newsletter Signup** - Integrated Ghost newsletter subscription

## 🛠️ Tech Stack

### Frontend
- **React** (Create React App)
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **React Router** - Navigation
- **React Helmet Async** - SEO meta tags

### Backend
- **FastAPI** (Python)
- **Ghost Admin API** - Member verification & full content access
- **Ghost Content API** - Article fetching

### Deployment
- **Frontend**: Vercel
- **Backend**: Render
- **CMS**: Ghost Pro
- **Payments**: Razorpay

## 🔧 Environment Variables

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
REACT_APP_GHOST_URL=https://your-site.ghost.io
REACT_APP_GHOST_CONTENT_API_KEY=your_content_api_key
```

### Backend (.env)
```
GHOST_URL=https://your-site.ghost.io
GHOST_ADMIN_API_KEY=id:secret
GHOST_CONTENT_API_KEY=your_content_api_key
MONGO_URL=mongodb://... (optional)
```

## 🚀 Deployment

### Frontend (Vercel)
1. Connect GitHub repo
2. Set root directory to `frontend`
3. Add environment variables
4. Deploy

### Backend (Render)
1. Connect GitHub repo
2. Set root directory to `backend`
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Add environment variables
6. Deploy

## 📁 Project Structure

```
├── frontend/          # React application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # Auth & Theme contexts
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page components
│   │   └── services/     # Ghost API service
│   └── public/
│
├── backend/           # FastAPI server
│   ├── server.py      # Main API endpoints
│   └── requirements.txt
│
└── memory/            # Documentation
    └── PRD.md
```

## 🔗 Key URLs

- **Live Site**: https://www.stateofplay.club
- **Ghost Admin**: https://the-state-of-play.ghost.io/ghost
- **Backend API**: https://stateofplay-backend.onrender.com

## 📝 License

Private - The State of Play © 2026 Left Field Ventures

---

Built with ❤️ using [Emergent](https://emergent.sh)
