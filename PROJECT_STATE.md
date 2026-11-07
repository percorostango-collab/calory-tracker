# Stato del progetto

## Obiettivo corrente
Implementazione Gemini AI (Backend) completata e verificata. Prossimo passo: integrazione Frontend.

## Ultima milestone completata
Integrazione API Gemini per lookup nutrizionale via testo e immagine.

## Lavoro in corso
Nessuno.

## Decisioni importanti
- Modello utilizzato: `gemini-3.5-flash-lite`.
- API routes: `POST /api/nutrition/text` e `POST /api/nutrition/image`.
- Error handling: mappatura esplicita degli errori Gemini su status code HTTP.

## Problemi aperti
Nessuno.

## Lezioni apprese
- Il modello `gemini-2.5-flash-lite` non è disponibile per i nuovi utenti (errore 404).
- È fondamentale usare `responseSchema` per garantire l'integrità dei dati strutturati.
