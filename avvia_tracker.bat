@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo    AVVIO CALORY TRACKER
echo ==========================================

:: 1. Verifica presenza node_modules
if not exist "node_modules\" (
    echo [!] node_modules non trovato. Installazione dipendenze in corso...
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo [X] Errore durante npm install. Verifica la connessione o la presenza di Node.js.
        pause
        exit /b !ERRORLEVEL!
    )
    echo [OK] Installazione completata.
) else (
    echo [OK] Dipendenze gia installate.
)

:: 2. Avvio server di sviluppo
echo [>] Avvio server di sviluppo (http://localhost:3000)...
echo [!] Premi CTRL+C per fermare il server.
echo.

call npm run dev

if !ERRORLEVEL! neq 0 (
    echo.
    echo [X] Errore durante l'avvio del server.
    pause
    exit /b !ERRORLEVEL!
)
