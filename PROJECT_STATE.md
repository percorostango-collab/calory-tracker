# Stato del progetto

## Obiettivo corrente
Fase 3 completata e verificata (aggregate.ts: gramsPerKg opzionale aggiunto, test 93/93, tsc OK). Fase 2 Gemini: errore identificato come 503 "high demand" da Gemini (esterno, non schema/prompt). Prossimo passo: Fase 4 motore consigli (recommendations.ts).

## Ultima milestone completata
- Fase 1 migrazione additiva (codice scritto, backup `sqlite.backup-20261112-0955.db` esistente, migrazione parte all'avvio via `initDb()` → `runMigrations()` con `PRAGMA table_info`).
- Fase 2 schema Gemini: tutti i nuovi campi hanno `nullable: true`, `required` solo core; `nutrition-schema.ts` corretto, nessuna modifica necessaria. Chiamata reale su localhost:3000 → 502 mascherante un 503 di Gemini ("model experiencing high demand"). Non è un rifiuto di schema/prompt.
- Fase 3 calcolo totale (src/lib/health/aggregate.ts riscritto per tutta la sezione 2, src/lib/health/types.ts espansa con gramsPerKg e weightKg opzionale, test scripts/verifica-aggregazione.ts: 93 passati, 0 falliti; tsc --noEmit OK).
- Logging errore Gemini: `toGeminiError` logga il raw error lato server (`[Gemini] raw error:`) senza chiave; la route `/api/nutrition/text` espone `rawMessage` nella risposta.

## Lavoro in corso
Nessuno.

## Decisioni importanti
- Modello utilizzato: `gemini-3.5-flash-lite`.
- API routes: `POST /api/nutrition/text` e `POST /api/nutrition/image`.
- Error handling: mappatura esplicita degli errori Gemini su status code HTTP.
- `aggregateDay` moltiplica per `servings` tutte le liste nutrienti; separa `aggressiveCookingCount` (solo fritto/frittura) da `highTempCookingCount` (anche grigliato/arrosto); `mixed` quando entrambi i dati proteici mancano; `null` != `0` per i campi non estimabili; `gramsPerKg` richiede `weightKg` passato dal chiamante (null se mancante/<=0).
- Pasti: NON implementati (loggedAt è solo data, "non disponibile" nel confronto ✔/✘).

## Problemi aperti
- Fase 2 Gemini: chiamata reale su localhost:3000 restituisce 502 che nasconde 503 "high demand" da Gemini (servizio esterno). Verificare solo quando l'API è raggiungibile.

## Lezioni apprese
- Il modello `gemini-2.5-flash-lite` non è disponibile per i nuovi utenti (errore 404).
- È fondamentale usare `responseSchema` per garantire l'integrità dei dati strutturati.
- Il 502 generico di Gemini nascondeva un 503 "high demand": sempre leggere il rawMessage / server log prima di attribuire la causa al codice.
