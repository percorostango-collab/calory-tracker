@echo off
cd /d "%~dp0"
echo ==========================================
echo    AVVIO CALORY TRACKER
echo ==========================================
echo Cartella: %CD%
echo.

if not exist package.json goto nopkg
node -e "process.exit(require('./package.json').scripts.dev?0:1)" 2>nul
if errorlevel 1 goto nodev

if exist node_modules goto deps_ok
echo Installo le dipendenze, attendi...
call npm install
if errorlevel 1 goto fail
goto start

:deps_ok
echo [OK] Dipendenze gia installate.

:start
echo [i] Premi CTRL+C per fermare il server.
echo.
call npm run dev
if errorlevel 1 goto fail
goto end

:nopkg
echo [X] In questa cartella non c'e package.json.
echo     Questo file deve stare nella cartella principale del progetto PC.
goto end

:nodev
echo [X] Il package.json di questa cartella non ha lo script "dev".
echo     Cartella: %CD%
echo     Script disponibili:
call npm run
goto end

:fail
echo [X] Errore durante l'avvio del server.

:end
echo.
pause