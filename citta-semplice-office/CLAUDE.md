# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Citta Semplice Office** is a full-stack administrative portal for managing online requests (Istanze Online) for the Municipality of Catania, Italy. Monorepo structure with backend API and Angular frontend.

## Build and Development Commands

### Frontend (`/backoffice/frontend`)

```bash
npm start                    # Dev server with API proxy (localhost:4200)
npm run build               # Production build
npm test                    # Unit tests (Karma + Jasmine)
npm run lint                # TSLint code analysis
npm run e2e                 # End-to-end tests (Protractor)
```

### Backend (`/backoffice/backend`)

```bash
mvn clean install           # Full build
mvn spring-boot:run         # Dev server (localhost:8080)
```

### Prerequisites
- PostgreSQL running on localhost:5432 with database `io_db` (user: io_user)
- Database schema must be pre-created (Hibernate ddl-auto=none)

## Architecture

```
backoffice/
├── backend/                    # Spring Boot REST API (Java 8, Maven)
│   └── src/main/java/it/comct/ioadminbackend/
│       ├── controllers/        # REST endpoints (/api/*, /public/login)
│       ├── services/           # Business logic, JWT auth
│       ├── models/             # JPA entities and DTOs
│       ├── daemons/            # Scheduled tasks (stats, payments, CSV)
│       └── security/           # Authentication/Authorization
│
└── frontend/                   # Angular 8 SPA (TypeScript)
    └── src/app/
        ├── views/admin/        # Feature modules (istanze, moduli, servizi, etc.)
        ├── components/         # Reusable UI components
        ├── services/           # ApiAdminService (HTTP client), TokenService
        ├── shared/             # Guards, directives, utilities
        └── models/             # TypeScript interfaces
```

## Key Technical Details

- **Authentication**: JWT tokens via `X-Auth` header, stored in localStorage as "auth-token"
- **API Proxy**: Dev frontend proxies `/api` and `/public` to backend:8080 via `proxy.conf.json`
- **Parent POM**: Backend depends on `citta-semplice-suite:2.0.3` (external dependency)
- **External Libraries**: `iol-common`, `liburbismart`, `libpmpay` (internal shared libraries)

## External Integrations

- **Urbismart API**: Document management system
- **PmPay**: Payment gateway (PagoPA connectivity)

## Configuration

- **Dev profile** (`application-dev.properties`): Daemons disabled, local file paths
- **Prod profile** (`application-prod.properties`): Daemons enabled, production URLs, context path `/citta-semplice-office`

## Frontend Stack

- Angular 8.1.2, TypeScript 3.4.3
- PrimeNG 8.1.1 (data tables, charts)
- Bootstrap Italia 1.3.9 (Italian government design system)
- Angular Material 8.1.1, ng-bootstrap 5.1.4

## Code Style

- **TSLint**: Max 140 chars/line, single quotes, kebab-case selectors with `app-` prefix
- **EditorConfig**: 2 spaces indent, UTF-8, Unix line endings
