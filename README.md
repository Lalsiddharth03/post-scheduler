# Post Scheduler

A production-ready post scheduler web application that allows users to create, schedule, and automatically publish posts at a specified future time.

## Features

- **User Authentication**: Email + password registration and login with JWT tokens
- **Post Management**: Create, edit, and delete posts
- **Post Statuses**: DRAFT, SCHEDULED, PUBLISHED
- **Automatic Publishing**: Database-driven cron polling (scheduler endpoint)
- **Dashboard**: Overview of all posts with status counts
- **Responsive UI**: Modern dark theme with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom JWT with bcrypt password hashing
- **Styling**: Tailwind CSS + shadcn/ui components
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CRON_SECRET=your_cron_secret
```

### Database Setup

Run these SQL statements in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE post_status AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status post_status DEFAULT 'DRAFT',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at);
```

### Installation

```bash
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Posts
- `GET /api/posts` - List all posts (optional `?status=` filter)
- `POST /api/posts` - Create post
- `GET /api/posts/[id]` - Get single post
- `PUT /api/posts/[id]` - Update post
- `DELETE /api/posts/[id]` - Delete post

### Scheduler
- `POST /api/scheduler` - Publish due posts (requires `Authorization: Bearer CRON_SECRET`)

## Scheduler Setup

The scheduler endpoint should be called every minute by an external cron service:

```bash
curl -X POST https://your-domain.com/api/scheduler \
  -H "Authorization: Bearer your_cron_secret"
```

**Scheduler Logic**:
1. Selects posts where `status = 'SCHEDULED'` AND `scheduled_at <= current_timestamp`
2. Updates status to `'PUBLISHED'` and sets `published_at`
3. Idempotent - safe to run multiple times

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Auth pages (login, register)
│   ├── (dashboard)/     # Dashboard pages
│   ├── api/             # API routes
│   └── page.tsx         # Landing page
├── components/          # React components
├── contexts/            # Auth context
├── hooks/               # Custom hooks
└── lib/                 # Utilities
```

## License

MIT
