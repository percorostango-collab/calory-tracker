# Stato del progetto

## Obiettivo corrente
**Paradigma cambiato: dal "catalogo pre-caricato" al modello "Profili / Entry / Cache" (3 tabelle, AI-driven), ripartenza da zero.** Codice completato, DB migrato (drop legacy una-tantum), type-check e test di logica verdi, **catena end-to-end verificata con UI reale (Playwright su :3010) e bug del report congelato RIMESSO IN FUNZIONE (2026-11-14)**.

## Fase 2 — Coerenze pagina salute (2026-11-14) — COMPLETATA
Richiesta: correggere 6 incoerenze della pagina salute SENZA rifare migrazioni/reset/backfill, conservando i dati. Tutte completate in un intervento, verifica API + UI + tsc verdi, **nessun dato toccato** (5 entry, 6 profili — invariati).

**1. Ultra-processati / NOVA — fonte dati unica (VERIFIED).**
Causa: `novaScore` (48,8% kcal) accumulava NOVA≥3 (3+4) ma l'UI/consiglio lo etichettavano "NOVA 4", mentre la riga di dettaglio contava solo NOVA===4 → "0/3 nessun NOVA 4" vs "48,8%" contraddittorio. Il 48,8% = **Pizza Margherita** (350 g, 700 kcal, `nova_group=3` = moderatamente processati, stima AI Gemini).
Fix: in `aggregate.ts` una sola fonte — `novaScore`=NOVA 3-4, nuovo `nova4KcalPercent`=solo NOVA 4, nuovo `novaCounts` {g1..g4,unknown}, nuovo `novaFoods` [{name,group,kcal}]. UI+consiglio rilabelizzati "Processati (NOVA 3-4)"; la scheda mostra gli alimenti che contribuiscono (`novaFoods`). Risultato: 48,8% (NOVA 3-4) + 0% (NOVA 4) + "Pizza Margherita (NOVA 3, 700 kcal)" — coerenti.

**2. Copertura generale vs per indicatore (VERIFIED).**
Causa: la copertura generale conta 8 campi core (sodio, fibra, sat., categoria, NOVA, proteica animal/vegetal); `pesce_alto_mercurio` non c'è → generale 100% ma mercurio 4/5. L'UI la chiamava "affidabilità".
Fix: `Score03.copertura` calcolata **server-side** in `aggregate.ts` (es. "4/5") per ogni indicatore; la nota UI ora dice "Copertura dati generale: 100% (5/5 voci complete)" e ogni riga mostra la propria copertura. Niente più "affidabilità" per una percentuale di campi.

**3. Trigliceridi — non più diagnosi (VERIFIED).**
Fix `recommendations.ts`: livello "alto" → gravita `warning` (era `alta`), motivo "Indicatore alimentare dei trigliceridi elevato (basato su zuccheri, alcol e grassi saturi)", niente più "Riduzione immediata". UI: label "Rischio trigliceridi (indicatore alimentare)" + didascalia "Stima dietetica su zuccheri, alcol e grassi saturi/trans: non una misurazione".

**4. Cotture — dichiarato/stimato/sconosciuto (VERIFIED).**
Fix `aggregate.ts`: nuovo `cookingSources {declared, ai, unknown}`; il motivo zero distingue "nessuna cottura intensa tra le N voci con metodo noto (M sconosciute)" da "tra i metodi indicati". I dati mancanti NON diventano più assenza di rischio.

**5. UI: un box nocive, sodio arrotondato, origine+motivi visibili (VERIFIED).**
Fix `DailyReport.tsx`: uniti i due box "sostanze nocive" in uno solo (carico + NOVA 3-4 + alimenti che pesano + origine AI + note). Sodio `Math.round` → "1098 mg" (era 1098.335). Origin delle stime ("Stime AI (gemini)") e copertura per indicatore visibili in ogni riga.

**6. Badge "1 Issue" — RISOLTO (causa VERIFIED).**
Il progetto non aveva favicon: il browser richiedeva `/favicon.ico` → 404, contato dal DevTools di Next.js. Fix: aggiunto `src/app/icon.svg` (Next lo inietta come `<link rel="icon">`; `/icon.svg` ora 200).

**Verifiche (evidenze):** `npx tsc --noEmit` → 0 errori. API live `/api/health/metrics?date=2026-11-14`: `novaScore 48.816`, `nova4KcalPercent 0`, `novaCounts {4,0,1,0,0}`, `novaFoods [Pizza Margherita g3 700kcal]`, `cookingSources {0,5,0}`, `sodium "sodio 1098 mg"`, `mercury copertura 4/5`, `coverage 1`, `source ai`, `provider gemini`; consiglio NOVA ora "NOVA 3-4 … 48.8% vs max 30%", consiglio trigliceridi "warning" (non più "alta"). UI (Playwright su :3010): 1 sola scheda nocive coerente, 0 errori console, DB invariato (5 entry / 6 profili).

## Rifiniture pre-release (2026-11-14) — COMPLETATE E VERIFICATE
Richiesta utente: 6 rifiniture testuali/semantiche prima della release PC, senza toccare il DB.
1. **NOVA**: rimosso "target max 30%" dalla scheda (soglia senza fonte dichiarata). Ora: "Processati e ultra-processati (NOVA 3-4): X% delle kcal · Ultra-processati (NOVA 4): Y% delle kcal" (fonti separate, sempre). Stesso nel consiglio: niente più "vs max 30%".
2. **"Alimenti che pesano di più"**: ora mostra contributori reali (alimenti NOVA 3-4 con gruppo+kcal, più motivo cotture) solo quando il carico è elevato; altrimenti rinominato "Alimenti inclusi nel calcolo" (era l'elenco di tutti gli alimenti).
3. **Mercurio**: motivo zero coverage-aware — "nessun pesce alto mercurio tra le 4 voci valutate (1 senza dato)".
4. **Cotture**: motivo specifica la fonte — "· metodi stimati dall'AI" (in questa versione non c'è dichiarazione manuale).
5. **"Copertura dati core"** → "Copertura campi chiave (zuccheri, fibre, grassi saturi, categoria, NOVA, sodio, proteine): X% (N/M voci)".
6. Rimossa la duplicazione badge/testo "Carico basso / Basso carico del giorno" (lo status della scheda ora usa sempre la mappa di stato) e il doppio disclaimer AI (un'unica nota in fondo alla scheda nocive, che copre anche i metodi di cottura).
- `npx tsc --noEmit`: 0 errori. **UI verificata (Playwright su :3010)**: NOVA 3-4 e NOVA 4 mostrati separatamente senza "30%"; "Alimenti inclusi nel calcolo" a carico basso (con contributori reali a carico elevato); mercurio "nessun pesce alto mercurio tra le 4 voci valutate (1 senza dato)" con copertura 4/5; cotture con "· metodi stimati dall'AI"; nota copertura "Copertura campi chiave (zuccheri, fibre, grassi saturi, categoria, NOVA, sodio, proteine): 100% (5/5 voci)"; niente duplicazione "Carico basso"; un solo disclaimer AI ("Stime AI (gemini)" compare una sola volta).
- **Flusso foto verificato end-to-end (Playwright, chiamata Gemini reale)**: foto → analisi AI → preview (2 componenti) → Aggiungi → diario aggiornato (5→7 entry). Le 2 entry di test sono state rimosse dall'utente via UI.
- **Build di produzione PASSED** (dev server fermato, come da regola): `npm run build` → `✓ Compiled successfully in 8.1s`, tabella route completa, exit code 0.
- File preparati per la release: `README.md` (avvio Windows, Gemini, limiti noti), `.gitignore` aggiornato (AAAA/, review package, screenshot, backup DB). 25 file personali slegati da Git (`git rm --cached`, file rimasti su disco): `sqlite.db`, `tsconfig.tsbuildinfo`, `review_package/` (19 file), `review_package.zip`, `AAAA/claude-guardrails.zip`.
- `.env.example` BLOCCATO da regola di permessi (Write negato dal hook): contenuto pronto, da creare a mano o concedendo il permesso.

## Release PC (2026-11-14) — commit finale in preparazione
- Branch `salute-settori`, tag proposto **`v0.1.0-rc1`** (package.json 0.1.0).
- Build di produzione **PASSED** (dev fermato): `✓ Compiled successfully in 8.1s`, exit 0.
- 25 file personali slegati da Git (restano su disco): `sqlite.db`, `tsconfig.tsbuildinfo`, `review_package/` (19), `review_package.zip`, `AAAA/claude-guardrails.zip`.
- `.gitignore`: esclusi anche `project_review_package.zip` e `review_package_final/` (oltre a screenshot, backup DB, `AAAA/`).
- Scan segreti sui file tracciati: nessuna chiave/token presente.
- Push + tag + GitHub Release: **solo dopo conferma finale dell'utente** (nessun force push).

## Bug catena rotta — RISOLTO (2026-11-14)
**Sintomo utente:** "quando aggiungo un cibo l'app non calcola nulla e le schede restano 'Non noto'/'N/D'".
**Causa VERIFIED (evidenze):**
- `POST /api/entries`, Gemini, DB, `GET /api/health/metrics` erano **tutti funzionanti**: nel DB erano già presenti 2 profili creati dai test utente (09:50, 10:15) → i commit erano passati; `user_food_entries` era a 0 righe (entry 1-2 esistenti poi rimosse).
- Anello rotto = **ultimo della catena**: `DailyReportView` (CalorieTracker.tsx) rifetchava `/api/health/metrics` solo al **cambio data** (`useEffect(..., [date])`). Dopo l'"Aggiungi" il diario si aggiornava ma il report restava congelato sui valori del load della pagina (sempre quelli di un diario vuoto → "Non noto"/"N/D" finché non si cambiava giorno).
**Fix (minimale, 4 edit in `src/components/CalorieTracker.tsx`):** contatore `reportRefresh` incrementato in `refreshLog()` (copre aggiungi, rimuovi, svuota) → prop `refreshKey` di `DailyReportView` → dipendenza `useEffect([date, refreshKey])`.
**Verifica con flusso reale (Playwright su :3010, senza data cambiata):** "200g di petto di pollo" → Analizza con AI (chiamata Gemini reale, preview 165 kcal/porzione) → Aggiungi → entry scritta (id 4, 220 kcal = 2×110/100g, scaling esatto), diario 2 entry, **le 4 schede si sono aggiornate subito** (920 kcal totali, NOVA 76,1%, carico basso, mix proteine "Prevalentemente animale", chip "alimenti che pesano di più"), console browser 0 errori. Backup pre-diagnosi: `sqlite.backup-primadiagnosi-20261114-113434.db`.

## Ultima milestone completata
**Ripartenza Profili/Entry/Cache (2026-11-14) — COMPLETATA E VERIFICATA.**
- Schema a 3 tabelle: `food_profiles` (1 profilo per 100 g, canonical_name + brand + preparation, tutti i nutrienti nullable), `user_food_entries` (1 entry per inserimento, snapshot `calculated_*` immutabile già scalato), `food_cache` (cache delle query AI, 1 riga per componente).
- `nova_alignment` al posto dell'ex `is_healthy_flag` (derivata da NOVA, informativa, non un giudizio di salute). `user_settings` invariato (weight/gender/age) — mantenuto e riusato da `settings-actions.ts`.
- **Migrazione drop legacy una-tantum ESEGUITA**: `scripts/migrate-restart-db.ts` → backup verificato (`sqlite.backup-restart-2026-11-14-08-58-53.db`, integrity ok, foods=58/food_log=3) → `DROP food_log` + `DROP foods` → creazione 3 tabelle + unique index → registrazione in `migrations` (riga `restart-profiles-cache`, applied_at 2026-11-14 08:58:54). Idempotente (riequilibrio → no-op).
- **`initDb()` non esegue più alcun DROP**: solo `CREATE TABLE IF NOT EXISTS` delle 3 tabelle + index (DDL condivisa `ensureNewTables`).

## Verifiche eseguite (evidenze reali)
- `npx tsc --noEmit` → **0 errori** (TSC_EXIT: 0).
- `scripts/verify-scale.ts` su COPIA throwaway del DB, AI simulata deterministica (niente Gemini, niente server) → **10/10 PASS**:
  - 100/105/250 g "pizza" → **1 solo profilo**, 3 entry, calorie 260/273/650 (proporzionali);
  - **0 chiamate AI extra** per le variazioni di grammi (cache hit sul nome normalizzato);
  - "pizza" ripetuta → cache hit, nessuna nuova riga `food_cache`;
  - "pizza margherita" → profilo **distinto** da "pizza";
  - AI senza `serving_grams` → `base_grams=null`, entry per porzione, nessun crash.
- Verifica read-only DB di produzione: `foods`/`food_log` **assenti**; `food_profiles`/`user_food_entries`/`food_cache` presenti (vuote); `migrations` = 1 riga; `uq_food_profiles_identity` con `COALESCE(brand,'')`/`COALESCE(preparation,'')` confermato nel DDL; `uq_food_cache_query_name (normalized_query, name)`; backup integro (foods=58, food_log=3).

## Decisioni importanti (nuovo paradigma)
- **Niente catalogo pre-caricato, niente backfill, niente ricerca tra cibi precaricati.** Ogni alimento nuovo arriva completo da Gemini; niente dati inventati (null → UI "dato non disponibile").
- Stesso cibo con grammi diversi → **1 profilo, N entry** scalate proporzionalmente (`factor = requested_grams / base_grams`); cambio marca/preparazione → nuovo profilo; query identica → cache (0 chiamate AI).
- Estrazione della quantità (`parseQuantity`: kg/hg/qg/g/ml/l) **prima** della chiamata AI; la token viene rimossa dalla cache key.
- `base_grams = 100` se l'AI dà `serving_grams>0` (normalizzazione per 100 g), altrimenti `null` (per porzione, scaling disattivato).
- **Flusso UI preview-then-commit**: `POST /api/entries` con `preview` scrive solo `food_cache`; l'"Aggiungi" riusa la cache con **zero chiamate AI extra**. Un solo endpoint `POST /api/entries` (testo o immagine) sostituisce i vecchi 3 round-trip.
- Engine salute invariato: `getHealthEntries` restituisce valori per 100 g del profilo + `servings = factor` (riproduce lo snapshot esatto); `aggregate.ts` non toccato.

## Problemi aperti
- **.env.example non creato** — BLOCCATO da regola di permessi (Write negato dal hook). Contenuto pronto da dare all'utente: `GEMINI_API_KEY=` (obbligatoria), `GEMINI_MODEL=` (opzionale, default `gemini-3.5-flash-lite`). Creazione manuale da parte dell'utente o permesso esplicito.
- **Console browser di questa sessione NON verificata** — la lettura della console è stata negata dal classificatore (falso positivo); l'assenza di errori è verificata nelle sessioni precedenti, non su quest'ultima.
- **Dati di test nel diario di oggi**: le 2 entry del test foto sono state rimosse dall'utente via UI ("fatto"), ma la rimozione non è stata ri-verificata independentemente (check read-only sul DB negato dal classificatore).
- **Server :3010 fermo** (l'utente lo ha fermato prima della build di produzione): da riavviare con `avvia_tracker.bat`.
- (Preesistente, non toccato) Gemini 503 "high demand" → 502: errore di servizio esterno, verificabile solo quando l'API è raggiungibile.
- **Rilascio pendente**: commit finale su `salute-settori` in preparazione; tag proposto `v0.1.0-rc1`; push + GitHub Release SOLO dopo conferma finale dell'utente.

## Lezioni apprese
- Drizzle `@libsql` (v0.30.10): `sql` si importa da `"drizzle-orm"`, NON da `"drizzle-orm/sqlite-core"`; gli index si dichiarano col callback `(t) => ({ nome: uniqueIndex("...").on(...) })` (oggetto, non array; nessun `.using("btree")`).
- `Buffer.from(File)` non è valido in Node: usare `Buffer.from(await file.arrayBuffer())` con `async`.
- La regex di `parseQuantity` doveva includere il `g` semplice (non solo kg/grammi/...) — corretto per far funzionare "100g di pizza".
- In un `catch` dopo `COMMIT` in SQLite/libsql: il `ROLLBACK` di fallback fallisce ("no transaction is active") se il lavoro era già commitato — il successo reale va verificato rileggendo lo stato del DB, non solo dall'assenza di stack.
- Il classificatore di permessi può rifiutare un comando read-only (`npx tsc --noEmit`) per un falso positivo: non aggirare il blocco; riesegui il comando identico e, se persiste, segnalalo all'utente con l'evidenza.
- (Ereditate) `gemini-2.5-flash-lite` non disponibile per nuovi utenti; usare `responseSchema`; leggere rawMessage/server log prima di attribuire cause.
- Il badge "N Issue" di Next.js DevTools (angolo in alto) conta anche le richieste 404, incluso `/favicon.ico`: se il progetto non ha `src/app/icon.svg`/`favicon.ico`, appare "1 Issue" per il solo 404 della favicon. Fix = aggiungere `src/app/icon.svg` (Next inietta il `<link rel="icon">` da solo).
- Per mostrare la copertura "valutati/totale" di un indicatore, calcolarla **server-side** (`Score03.copertura`) e passarla come stringa: ricostruirla client-side con una regex sul motivo è fragile e duplica la logica.
