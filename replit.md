# WP Content Optimizer PRO

## Overview
WP Content Optimizer PRO is an AI-powered SEO optimization application built with React, TypeScript, and Vite. It helps transform content into ranking machines by adapting to Google's algorithm in real-time.

## Project Structure
- `/src` - Main source code
  - `/components` - React components
  - `/hooks` - Custom React hooks
  - `/lib` - Utility libraries
    - `/api` - API client for server communication
  - `/pages` - Page components
- `/server` - Express.js backend server
  - `index.ts` - Server entry point
  - `routes.ts` - API route handlers
  - `db.ts` - Database connection
- `/shared` - Shared code between client and server
  - `schema.ts` - Drizzle ORM database schema
- `/public` - Static assets

## Tech Stack
- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand, TanStack Query
- **UI Components**: Radix UI
- **AI Integration**: OpenAI, Anthropic, Google GenAI
- **Backend**: Express.js on Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **ORM**: Drizzle ORM with drizzle-kit

## Development
The application runs two servers:
- Frontend (Vite): Port 5000 (exposed to users)
- Backend (Express): Port 3001 (proxied via Vite)

```bash
npm run dev
```

## Database Commands
```bash
npm run db:push    # Push schema changes to database
npm run db:studio  # Open Drizzle Studio for database management
```

## Build
```bash
npm run build
```

The built files are output to the `dist` directory.

## Recent Changes
- February 5, 2026: **Major Migration** - Migrated from Supabase to Express + PostgreSQL + Drizzle ORM
  - Replaced all Supabase Edge Functions with Express API routes
  - Database now uses Neon PostgreSQL with Drizzle ORM
  - API endpoints: `/api/blog-posts`, `/api/wp-discover`, `/api/fetch-sitemap`, `/api/neuronwriter`, `/api/wordpress-publish`
- February 2026: Configured for Replit environment with port 5000 and allowed hosts
- February 2026: Fixed sitemap persistence - crawled URLs now survive navigation via Zustand store integration
- February 2026: Enhanced QualityValidator scoring for more accurate 90%+ targets (readability, SEO, E-E-A-T, uniqueness, fact accuracy)
- February 2026: Verified NeuronWriter integration searches for existing queries before creating new ones
- February 2026: Content generation prompts target 90%+ in all quality metrics with Alex Hormozi/Tim Ferriss writing style

## Key Architecture Notes
- **State Persistence**: Uses Zustand with `persist` middleware - sitemapUrls are persisted and restored to local UI state via useEffect
- **Database Persistence**: Generated blog posts are saved to PostgreSQL `generated_blog_posts` table via Drizzle ORM
- **API Layer**: Express server at `/server` handles all backend operations, proxied through Vite in dev
- **Quality Scoring**: QualityValidator.ts calculates scores for readability (grade 5-10 optimal), SEO, E-E-A-T (checks for citations, expert quotes, first-person), uniqueness (AI phrase detection), and fact accuracy
- **NeuronWriter**: Service searches existing queries by keyword before creating new ones to prevent duplicates
- **Content Generation**: EnterpriseContentOrchestrator.ts uses comprehensive prompts for 90%+ scores with premium HTML design elements (glassmorphic boxes, neumorphic cards, gradient tables)

## Database Setup
The application uses Replit's built-in PostgreSQL database. The schema is automatically managed via Drizzle ORM.

Environment variables (automatically provided by Replit):
- `DATABASE_URL` - PostgreSQL connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Individual connection parameters

To push schema changes:
```bash
npm run db:push
```

## API Endpoints
All API endpoints are served from the Express server on port 3001, proxied via Vite:

- `GET /api/blog-posts` - Load all saved blog posts
- `POST /api/blog-posts` - Save a new blog post
- `PATCH /api/blog-posts/:id` - Update a blog post
- `DELETE /api/blog-posts/:id` - Delete a blog post
- `POST /api/wp-discover` - Discover WordPress post URLs via REST API
- `POST /api/fetch-sitemap` - Fetch and parse sitemap XML
- `POST /api/neuronwriter` - Proxy requests to NeuronWriter API
- `POST /api/wordpress-publish` - Publish content to WordPress
