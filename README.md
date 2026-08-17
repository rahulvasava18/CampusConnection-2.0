# CampusConnection

CampusConnection is a campus-focused social application for student interaction, networking, communities, teams, projects, events, recommendations, and communication. The repository contains the current web application, API, realtime gateway, background worker, and shared TypeScript package.

## Current Architecture

CampusConnection is a TypeScript monorepo with independently runnable frontend, API, realtime, and worker processes.

```text
React/Vite frontend
        |
        +--> Express API (/api) ------> MongoDB
        |             |                    (authoritative storage)
        |             +--> Redis
        |             +--> Cloudinary media storage
        |             +--> HTTPS email provider (Resend in production)
        |
        +--> Socket.IO realtime process --> Redis adapter

BullMQ worker process --> Redis queues --> MongoDB-backed domain data

packages/shared
        |
        +--> shared TypeScript contracts used by frontend and backend
```

The backend uses MongoDB as durable authoritative storage. Redis supports caching, rate limiting, realtime coordination, and BullMQ. The realtime process is authenticated separately through the existing access-token/session model. Cloudinary is the current image-storage provider behind a media-storage abstraction. Email delivery is provider-abstracted: local development may use Gmail SMTP, while production uses the Resend HTTPS API through the worker.

## Repository Structure

```text
App/
├── backend/              Express API, realtime gateway, worker, modules, and tests
├── frontend/             React/Vite application
├── packages/shared/      Shared TypeScript types and contracts
├── tests/e2e/            Playwright browser tests
├── tests/qa/             QA scenarios and report tooling
├── tests/performance/    Health smoke checks
├── docs/                 Architecture, environment, authentication, and QA documentation
├── .github/workflows/    Continuous integration workflow
├── docker-compose.yml    Local MongoDB replica set and Redis services
└── package.json          Workspace scripts
```

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS with the Vite plugin
- TanStack Query
- Zustand
- React Hook Form and Zod
- Socket.IO client
- Lucide React icons

### Backend

- Node.js and TypeScript
- Express 5
- Zod request validation
- Mongoose 8
- Pino and pino-http logging
- Helmet and CORS
- JSON Web Tokens with RS256
- Nodemailer
- Multer

### Database and infrastructure

- MongoDB 7 with a local replica-set-capable Docker configuration
- Redis 7
- BullMQ for background jobs
- Socket.IO with the Redis adapter for realtime communication
- Cloudinary for the current image-storage implementation
- Resend HTTPS email delivery in production, with local Gmail SMTP support

### Testing

- Vitest
- Supertest
- Playwright
- ESLint
- TypeScript compiler checks

## Prerequisites

- Node.js 22 is used by the CI workflow.
- npm with workspace support.
- Docker with Docker Compose support for local MongoDB and Redis.

## Environment Variables

Environment files are local configuration and must never be committed. Copy the appropriate templates and provide values locally:

- `.env.example` — repository-level development configuration reference.
- `backend/.env.example` — backend configuration reference.
- `frontend/.env.example` — frontend Vite configuration reference.
- `backend/.env.test.example` — isolated QA/test configuration reference.

Backend variables cover runtime ports, MongoDB, Redis, CORS, JWT/session and CSRF settings, email provider configuration, Cloudinary, queues, outbox processing, search, realtime limits, and rate limits. Frontend variables use the `VITE_` prefix for the API and realtime URLs. Secrets, passwords, tokens, private keys, SMTP credentials, email API keys, and Cloudinary secrets belong only in local or hosting-provider secret configuration.

## Local Development

Install workspace dependencies from the repository root:

```bash
npm ci
```

Start the local infrastructure:

```bash
docker compose up -d
```

The local defaults expose MongoDB on port `27018` and Redis on port `6380`. The MongoDB container is configured as a single-node replica set for transaction-compatible local development.

Run each application process in its own terminal:

```bash
npm run dev:api
npm run dev:realtime
npm run dev:worker
npm run dev:web
```

The API, realtime, and worker commands independently build the shared package before starting their process. If only the frontend is being run, build the shared package first:

```bash
npm run dev:shared
npm run dev:web
```

The default local ports are:

- Frontend: `5173`
- API: `4000`
- Realtime: `4001`

Build all workspaces for a production-style validation:

```bash
npm run build
```

## Testing

From the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:all
npm run test:qa
npm run test:qa:performance
```

The test suite includes backend unit tests, backend integration tests, Playwright browser tests, QA contract/security/database tooling, and a health performance smoke check. Backend-specific QA commands are also available through the workspace scripts.

```bash
npm run test:qa:contract -w @campusconnection/backend
npm run test:qa:database -w @campusconnection/backend
```

## Health Checks

The public root endpoint returns service status without authentication:

```text
GET /
HEAD /
```

The API exposes liveness and dependency readiness under the versioned API base path:

```text
GET /api/health
GET /api/ready
```

The API also exposes compatibility health routes at `/health` and `/ready`. The realtime process exposes:

```text
GET /health
GET /ready
```

Readiness reports MongoDB, Redis, and BullMQ dependency state. The worker process does not expose an HTTP endpoint.

## Production Overview

Production is intended to keep the processes independently deployable while remaining cloud-agnostic:

```text
Hosted frontend
       |
       +--> Managed API process ------> Managed MongoDB
       |              |
       |              +--> Managed Redis
       |
       +--> Socket.IO realtime process

Managed worker process --> Managed Redis queues

API services --> Cloudinary media storage
Managed worker --> Resend HTTPS email provider

Production API, realtime, and worker services must each receive the shared backend configuration.
At minimum, Render must explicitly provide `MONGO_URI`, `MONGO_DB_NAME`, `REDIS_URL`,
`CORS_ORIGINS`, `WEB_ORIGIN`, `FRONTEND_URL`, `EMAIL_PROVIDER=resend`, `EMAIL_API_URL`,
`EMAIL_API_KEY`, `EMAIL_FROM`, inline RS256 JWT keys, and `COOKIE_SECURE=true`. Missing or local
development infrastructure values fail configuration validation instead of falling back to
localhost.
```

Production secrets must be supplied through the hosting provider's secret or environment-variable system. The repository does not contain production deployment credentials or provider URLs.

## Security Notes

- Never commit `.env` files or local secret files.
- Never commit or expose private JWT keys.
- Never place backend secrets in frontend Vite environment variables.
- Use HTTPS in production.
- Configure explicit production CORS origins.
- Use secure production cookies and the configured CSRF protection.
- Keep JWT, database, Redis, SMTP/email-provider, and Cloudinary credentials in secret management.
- Do not use the local development MongoDB or Redis configuration as production infrastructure.

## Deployment Status

CampusConnection is currently being prepared for production deployment. Production hosting, managed services, secrets, domains, and deployment pipelines are not claimed to be configured or deployed by this repository.

## Development vs Production

```text
Development
local Vite, API, realtime, and worker processes
local MongoDB replica set and Redis via Docker Compose
local environment files

Production
hosted frontend
independently hosted API, realtime, and worker processes
managed MongoDB and Redis
provider-managed secrets and HTTPS
```
