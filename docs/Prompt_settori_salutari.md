Piano di Implementazione: Settori Salutari (PC)

Contesto
L'obiettivo è estendere il Calory Tracker (versione PC) per includere un'analisi metabolica avanzata divisa in 4 settori (Zuccheri, Lipidi, Proteine, Sostanze Nocive) e un motore di consigli per il giorno successivo. Il lavoro deve essere additivo, portabile e non deve rompere la versione attuale.
Obiettivi e Vincoli

Target: Solo versione PC (radice).
Sicurezza: Migrazioni additive (solo ALTER TABLE, nulla di distruttivo). Backup del DB prima di iniziare.
Architettura: Logica pura in src/lib/health/ (indipendente da DB/Next/React). Un adattatore in src/lib/health-adapter.ts per il DB.
AI: Estendere le API esistenti per restituire i nuovi campi nutrienti (nullable).
Interfaccia: Nuova sezione "Resoconto del giorno" con schede e selettore di data (giorno precedente/successivo).
Fasi di Lavoro
Fase 0 - Ricognizione (COMPLETATA)

Analisi DB, API Gemini, e UI completata.
Fase 1 - Modello Dati (Additivo)

Backup: Creare sqlite.backup-[TIMESTAMP].db.
Schema: Estendere foods (nutrienti, categoria, gruppo NOVA, flag salute, fonte) e food_log (metodo cottura).
Impostazioni: Creare tabella user_settings (peso, sesso, età).
Migrazione: Eseguire ALTER TABLE in src/db/index.ts con controlli PRAGMA table_info per garantire l'idempotenza.
Verifica: Controllare che le voci esistenti siano intatte e che il conteggio righe sia identico.
Fase 2 - Estrazione Nutrienti con Gemini

Prompt & Schema: Aggiornare nutritionSchema e il prompt in src/lib/gemini.ts.
API: Estendere POST /api/nutrition/text e image per gestire i nuovi campi. Se mancano, restituire null (non 502).
Validazione: Aggiornare parseFoodResponse per i nuovi campi.
Verifica: Testare le API con un alimento noto e verificare il JSON di risposta.
Fase 3 - Calcolo Totali (Funzioni Pure)

Implementazione: Creare src/lib/health/aggregate.ts per calcolare i 4 settori e la copertura dati.
Test: Creare scripts/verifica-aggregazione.ts con casi limite (dati null, dati completi, giorno vuoto).
Verifica: Eseguire via npx tsx.
Fase 4 - Motore Consigli

Implementazione: Creare src/lib/health/recommendations.ts basato su soglie in targets.ts.
Test: Validazione logica su scenari (es. "troppi zuccheri", "poca fibra").
Verifica: Eseguire via npx tsx.
Fase 5 - Interfaccia UI

Selettore Data: Aggiungere controllo data (giorno $\pm$ 1) nella UI, correggendo il calcolo in page.tsx per usare l'ora locale.
Resoconto: Creare la pagina/sezione con le 4 schede settori e la scheda consigli.
Verifica: Test visivo e controllo che i dati mostrati corrispondano ai calcoli.
Fase 6 - Base di Conoscenza

Implementazione: Creare src/lib/health/knowledge.ts con le categorie e i consigli su cottura/acquisto.
Verifica: Controllo integrità testi.
Fase 7 - Verifica Finale & Porting

Test System: tsc, lint, build.
Verifica DB: Assicurarsi che i dati vecchi siano perfetti.
Documentazione: Creare PORTING.md per il futuro passaggio al mobile.
File Critici da Modificare

src/db/index.ts, src/db/schema.ts
src/lib/gemini.ts, src/lib/server-actions.ts, src/lib/types.ts
src/app/api/nutrition/text/route.ts, src/app/api/nutrition/image/route.ts
src/app/page.tsx, src/components/CalorieTracker.tsx
Verifica Finale (Criteri di Accettazione)

L'app non crasha e i dati vecchi sono presenti.
Il resoconto mostra i 4 settori con i valori corretti.
I nuovi campi Gemini sono gestiti con null se mancanti.
PORTING.md è pronto.
Posso iniziare con la Fase 1 (Backup e Migrazione)?