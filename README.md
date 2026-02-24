# GRAND LINE v8.0

E-commerce Command Center for Dropshipping Analytics

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ installed
- Firebase project created

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Add your Firebase credentials to .env.local

# Run development server
npm run dev
```

Visit `http://localhost:3000`

## 📁 Project Structure

```
grand-line-v8/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Global dashboard
│   ├── logpose/           # Projection tool
│   ├── [country]/         # Dynamic country routes
│   └── page.tsx           # Landing page
├── lib/
│   ├── firebase/          # Firebase config & helpers
│   │   ├── config.ts      # Client SDK
│   │   ├── admin.ts       # Admin SDK
│   │   └── firestore.ts   # Database helpers
│   ├── calculations/      # Business logic
│   │   └── kpis.ts        # KPI formulas
│   └── utils/             # Utilities
│       ├── status.ts      # Order status classification
│       └── currency.ts    # Currency conversion
├── components/            # React components
└── public/               # Static assets
```

## 🔧 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Charts**: Recharts
- **AI**: Google Gemini 2.5 Pro

## 📊 Features

### Implemented
- ✅ Firebase configuration (client + admin)
- ✅ Firestore helpers (app_data, order_files, user_profiles)
- ✅ KPI calculation engine
  - Utilidad Real (Real Profit)
  - ROAS (Return on Ad Spend)
  - Proyección Financiera (Financial Projection)
- ✅ Currency conversion with live exchange rates
- ✅ Order status classification
- ✅ Country detection from city names
- ✅ Product name normalization

### In Progress
- 🔄 Firebase Authentication
- 🔄 File upload & parsing
- 🔄 Dashboard UI

### Planned
- ⏳ Campaign mapping (AI-powered)
- ⏳ Facebook/TikTok API integration
- ⏳ PDF report generation
- ⏳ User management
- ⏳ SUNNY campaign launcher

## 🔐 Environment Variables

See `.env.local.example` for required variables.

### Firebase
- `NEXT_PUBLIC_FIREBASE_*` - Client SDK config
- `FIREBASE_ADMIN_*` - Server SDK config

### APIs
- `FACEBOOK_ACCESS_TOKEN` - Facebook Graph API
- `TIKTOK_ACCESS_TOKEN` - TikTok Business API
- `GEMINI_API_KEY` - Google Gemini AI

## 📖 Documentation

- [Firebase Setup Guide](./FIREBASE_SETUP.md)
- [Technical Specification](../brain/.../technical_spec.md)
- [Implementation Plan](../brain/.../implementation_plan.md)

## 🧪 Testing

```bash
# Run tests (coming soon)
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## 🚢 Deployment

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
firebase deploy
```

## 📝 License

Private - GRAND LINE v8.0

---

Built with ⚓ by Antigravity AI
