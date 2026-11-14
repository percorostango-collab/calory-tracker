# Porting Notes: Gemini Error Handling

This document tracks changes made to the Gemini API integration to ensure robustness and security.

## Changes

### 1. Error Exposure (Security)
- **File**: `src/app/api/nutrition/text/route.ts`
- **Change**: The `rawMessage` field (containing the raw error from Gemini) is now conditionally exposed in the JSON response.
- **Constraint**: It is only sent if `process.env.NODE_ENV !== "production"`.
- **Reasoning**: In production, exposing raw API errors can leak implementation details or sensitive information. In development, it is vital for debugging "high demand" or schema mismatch issues.

### 2. Retry Logic (Robustness)
- **File**: `src/lib/gemini.ts`
- **Change**: Added `withRetry` utility for the `lookupNutritionFromText` and `lookupNutritionFromImage` functions.
- **Logic**: 
  - Retries up to 3 times.
  - Delays: 1s, 2s, 4s.
  - Retryable status codes: `429` (Quota), `503` (High Demand), `502` (Proxy/Masked error).
- **Reasoning**: Mitigates transient failures from the Gemini service (e.g., "model experiencing high demand").

### 3. Error Mapping
- **File**: `src/lib/gemini.ts`
- **Change**: Added explicit mapping for "high demand" and "overloaded" messages to a `503` status code in `toGeminiError`.
- **Reasoning**: Allows for more accurate client-side handling and cleaner retry triggering.
