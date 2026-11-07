# Calorie Tracker

A single-page web application for tracking daily calorie and macronutrient intake.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via `@libsql/client` and Drizzle ORM
- **Icons**: Lucide React

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`. On the first run, the database will be automatically initialized and seeded.

## Project Structure
- `src/app/`: Next.js App Router pages and API routes.
- `src/components/`: React client components.
- `src/db/`: Database schema, connection, and seeding logic.
- `src/lib/`: Shared types and server-side utility functions.
