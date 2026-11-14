# Calorie Tracker (versione PC)

App web locale per tracciare calorie e macronutrienti giornalieri, con stima
nutrizionale basata su AI (Google Gemini) e report di salute quotidiano.

## Requisiti

- Node.js 20+
- Chiave API Gemini (per la stima dei valori nutrizionali)

## Configurazione

1. `npm install`
2. Crea `.env` nella radice del progetto (partire da `.env.example`):

   ```
   GEMINI_API_KEY=<la tua chiave>
   ```

   La chiave si ottiene da https://aistudio.google.com/apikey
3. Al primo avvio il database `sqlite.db` viene creato e inizializzato
   automaticamente.

## Avvio su Windows

- Doppio clic su **`avvia_tracker.bat`**: avvia l'app su
  <http://localhost:3010> e apre il browser.
- In alternativa, da terminale nella cartella del progetto:
  `npm run dev -- -p 3010`

## Dati

- Tutti i dati sono in `sqlite.db` (locale, nessun account, nessun cloud):
  - `food_profiles` — un profilo nutrizionale per 100 g per alimento;
  - `user_food_entries` — le voci del diario (snapshot calcolato, immutabile);
  - `food_cache` — cache delle risposte AI per evitare chiamate ripetute.
- Fai una copia di `sqlite.db` prima di operazioni rischiose o per backup.

## Come funziona

- Descrivi un alimento (testo) o carica una foto: Gemini stima valori
  nutrizionali, classe NOVA e metodo di cottura; confermi la preview e
  l'alimento va nel diario.
- Stesso alimento con grammi diversi = 1 profilo, più voci nel diario
  (nessuna chiamata AI aggiuntiva grazie alla cache).
- Il report di salute mostra 4 settori: zuccheri, lipidi, proteine e sostanze
  nocive, con indicatori di carico e consigli.

## Limiti noti

- Tutti i valori nutrizionali sono **stime AI** (Gemini), non dati di
  laboratorio; la correzione manuale dei valori non è implementata in questa
  versione (anche i metodi di cottura sono stimati dall'AI, non dichiarati).
- La soglia di riferimento "30% di kcal da alimenti processati" non è
  mostrata: la scheda indica separatamente la quota NOVA 3-4 e la quota
  ultra-processati NOVA 4, senza un target senza fonte.
- L'API Gemini può restituire errori temporanei (es. 503 per carico elevato);
  in quel caso l'inserimento non avviene e l'errore viene mostrato.
- Il report di salute è un indicatore qualitativo di presenza/frequenza: non è
  una diagnosi medica.
- Utente singolo, solo locale: nessun account, nessuna sincronizzazione.
