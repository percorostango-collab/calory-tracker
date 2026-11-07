# Initial Build Decision Log - 2026-11-06

## Technical Decisions

### 1. Database Driver: `@libsql/client` instead of `better-sqlite3`
- **Problem**: `better-sqlite3` requires a C++ compilation environment (Visual Studio Build Tools) which was not available in the user's environment.
- **Solution**: Switched to `@libsql/client`, which uses pre-compiled binaries and is fully compatible with Drizzle ORM.
- **Benefit**: Enables immediate installation and running of the project without manual environment setup.

### 2. Database Initialization Strategy
- **Problem**: Need to ensure tables and seed data exist without a complex migration workflow for a small project.
- **Solution**: Implemented an `initDb` function in `src/db/index.ts` that uses raw SQL `CREATE TABLE IF NOT EXISTS` and an idempotent seeding function.
- **Benefit**: The app is "plug and play" — `npm run dev` handles everything.

### 3. API Architecture
- **Decision**: Used Next.js Route Handlers (`/api/foods`, `/api/log`) to decouple the frontend from the database.
- **Benefit**: Ensures all database operations are performed on the server side, adhering to security best practices and allowing for easy scaling/testing.

### 4. State Management
- **Decision**: Used React `useState` and `useEffect` for client-side state, synchronized with the server via `fetch` calls to the API.
- **Benefit**: Minimal complexity, no heavy state management libraries required for a single-page application.

## Completed Tasks
- [x] Scaffold Next.js project with Tailwind CSS and TypeScript.
- [x] Set up Drizzle ORM with `@libsql/client`.
- [x] Implement database schema and seed script.
- [x] Build API routes for food search and log management.
- [x] Implement core UI components (Summary, Search, Log).
- [x] Create `CLAUDE.md` and decision log.
