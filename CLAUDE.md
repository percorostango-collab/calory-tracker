# Calorie Tracker

A single-page web application for tracking daily calorie and macronutrient intake.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via `@libsql/client` and Drizzle ORM
- **Icons**: Lucide React
- **AI**: Gemini API (`gemini-3.5-flash-lite`)

## AI Nutrition Lookup
The application features AI-powered nutrition estimation using Google Gemini.
- **Text-based lookup**: `POST /api/nutrition/text` (takes `{ "description": "..." }`)
- **Image-based lookup**: `POST /api/nutrition/image` (takes `multipart/form-data` with an `image` file)
- **Environment Variable**: `GEMINI_API_KEY` is required in `.env`.

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

## Porte e Docker (importante)
- Le porte 3000, 3001 e 20128 sono di Docker: open-webui (3000), freellmapi (3001) e OmniRoute (20128, il gateway che permette a Claude di funzionare). Il processo che le occupa e' com.docker.backend: NON terminarlo MAI, ne' con taskkill ne' con Stop-Process, nemmeno se un hook suggerisce di terminare "quel PID". Terminarlo spegne il gateway e la sessione cade.
- Il Calory Tracker (versione PC) gira su http://localhost:3010, avviato dall'utente con avvia_tracker.bat. Non avviare altri server e non terminare processi: se serve riavviare il server, chiedilo all'utente.
