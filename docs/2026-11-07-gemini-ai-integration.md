# Gemini AI Integration

## Implementation Date: 2026-11-07

## Summary
Added AI-powered nutrition lookup capabilities to the Calorie Tracker using Google's Gemini API (`gemini-3.5-flash-lite`). This allows users to estimate calories and macronutrients from text descriptions or meal photos.

## Changes

### Backend API Routes
- **`POST /api/nutrition/text`**: 
  - Accepts a JSON body with a `description` string.
  - Uses `src/lib/gemini.ts` to call Gemini for nutritional estimation.
  - Returns structured JSON matching the `NewFood` type.
- **`POST /api/nutrition/image`**: 
  - Accepts `multipart/form-data` containing an `image` file and an optional `note` string.
  - Supports `image/jpeg`, `image/png`, and `image/webp`.
  - Uses multimodal Gemini capabilities to analyze the image and return nutritional data.

### Core Logic
- **`src/lib/gemini.ts`**: 
  - Centralized Gemini client logic with a singleton pattern.
  - Implements a robust `nutritionSchema` using Gemini's structured output capability (`responseMimeType: 'application/json'`).
  - Includes custom error handling (`GeminiError`) that maps SDK/API failures to appropriate HTTP status codes (401, 422, 429, 502).
  - Normalizes and validates AI output to ensure it conforms to the expected application types.

### Dependencies
- Added `@google/generative-ai` (v0.24.1).

## Decisions and Rationale

- **Model Choice**: Selected `gemini-3.5-flash-lite`. Initially attempted `gemini-2.5-flash-lite`, but it was discovered to be unavailable for new users via diagnostic testing.
- **Structured Output**: Used Gemini's built-in `responseSchema` rather than manual parsing of text to minimize parsing errors and ensure consistency with our `NewFood` interface.
- **Error Handling**: Implemented explicit error mapping to provide the frontend with meaningful status codes (e.g., 429 for quota, 422 for safety blocks).
- **Validation**: Added strict validation for input (description length, image MIME types, file size) and output (presence of fields, non-negative numbers) to maintain data integrity.

## Verification Results
- **TypeScript**: `npx tsc --noEmit` passed.
- **Text Lookup**: `POST /api/nutrition/text` with valid description returned 200 and correct JSON.
- **Image Lookup**: `POST /api/nutrition/image` with valid JPEG returned 200 and correct JSON.
- **Error Handling**: Verified 400 responses for empty descriptions and unsupported image types.
