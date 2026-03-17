# Fusion Evaluator

Fusion Evaluator is a full-stack application for managing lab modules, domain lead assignments, and pair/group evaluations. It includes a React frontend, an Express API, and a PostgreSQL database layer using Prisma.

## Highlights

- Google OAuth based login for admins and leads
- Role-aware module access (admin and lead)
- Module lifecycle management: create, update, duplicate, delete
- Group/pair management per module
- Evaluation data updates per group
- Merge workflow for pair evaluation operations
- Rate-limited authentication and JWT-protected API routes

## Tech Stack

- Frontend: React 19, Vite 6, Axios
- Backend: Node.js, Express, JWT, Google Auth Library
- Database: PostgreSQL, Prisma ORM
- Tooling: TypeScript (type checks), Concurrently

## Project Structure

```text
.
├── src/                  # React frontend app
├── lib/                  # Express API (controllers, services, middleware)
├── prisma/               # Prisma schema and migrations
├── server.js             # API + production static hosting entrypoint
├── api/                  # Alternative serverless API handlers
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- PostgreSQL 14+
- A Google Cloud OAuth Client ID

## Environment Setup

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Configure required variables in .env.local:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/fusion_evaluator
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
JWT_SECRET=your-secure-random-secret
```

Optional variables are documented in [.env.example](.env.example).

## Installation

```bash
npm install
```

## Database Setup

1. Apply/create migrations:

```bash
npm run db:migrate
```

2. Generate Prisma client:

```bash
npm run db:generate
```

## Running the App

Run frontend and backend together:

```bash
npm run dev:full
```

Other modes:

```bash
npm run dev      # Frontend on :3000
npm run server   # Backend on :5001
npm run preview  # Preview production build
```

## Quality Checks

Type check:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

## API Overview

Base path: /api/lab-manager

Public route:

- POST /auth/google

JWT-protected routes:

- GET /modules
- POST /modules
- GET /modules/:id
- PUT /modules/:id
- DELETE /modules/:id
- POST /modules/:id/duplicate
- POST /modules/:id/merge
- POST /modules/:id/groups
- PUT /modules/:id/groups/:groupId
- DELETE /modules/:id/groups/:groupId
- POST /modules/:id/groups/:groupId/duplicate
- PUT /modules/:id/groups/:groupId/evaluation

Authentication notes:

- Send Authorization: Bearer <token> for protected routes
- Tokens are issued after successful Google credential verification

## Deployment Notes

- In production, server.js serves the built frontend from dist/ and mounts API routes under /api/lab-manager.
- Configure ALLOWED_ORIGINS for CORS in non-local deployments.
- Ensure DATABASE_URL, GOOGLE_CLIENT_ID, and JWT_SECRET are provided in runtime environment.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflow, style conventions, and PR expectations.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
