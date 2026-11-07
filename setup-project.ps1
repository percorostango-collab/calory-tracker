<#
.SYNOPSIS
  Controllo e ripristino sicuro dell'ambiente per progetti web (Node/Next.js/Tailwind).

.DESCRIPTION
  Script "doctor" riutilizzabile per qualsiasi progetto.
  Esegue controlli sicuri, segnala i problemi e, solo con -Fix, installa/ripara
  ciò che manca. Non termina processi Node generici e non usa --force/--legacy-peer-deps.

.USAGE
  .\setup-project.ps1                 # solo diagnosi
  .\setup-project.ps1 -Fix            # diagnostica + installazione/riparazione sicura
  .\setup-project.ps1 -Port 3000      # verifica una porta specifica
  .\setup-project.ps1 -SkipBuild      # salta build/lint

.EXAMPLE
  .\setup-project.ps1 -Fix -Port 3000
#>

param(
  [switch]$Fix,
  [int]$Port = 3000,
  [switch]$SkipBuild,
  [switch]$InstallBuildTools
)

$ErrorActionPreference = 'Stop'
$script:Issues = New-Object System.Collections.Generic.List[string]
$script:Fixed  = New-Object System.Collections.Generic.List[string]

function Write-Section($Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Add-Issue($Message) {
  $script:Issues.Add($Message) | Out-Null
  Write-Host "  [PROBLEMA] $Message" -ForegroundColor Red
}

function Add-Fixed($Message) {
  $script:Fixed.Add($Message) | Out-Null
  Write-Host "  [RISOLTO]  $Message" -ForegroundColor Green
}

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PortProcess($Port) {
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $connection) { return $null }

  $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
  return [PSCustomObject]@{
    Port = $Port
    Pid = $connection.OwningProcess
    Name = if ($process) { $process.ProcessName } else { 'sconosciuto' }
    Path = if ($process) { $process.Path } else { '' }
  }
}

Write-Section '1. Ambiente di base'

# Node.js
if (Test-Command 'node') {
  $nodeVersion = (node --version)
  Write-Host "  Node.js: $nodeVersion"
} else {
  Add-Issue 'Node.js non è installato o non è nel PATH.'
}

# npm
if (Test-Command 'npm') {
  $npmVersion = (npm --version)
  Write-Host "  npm: $npmVersion"
} else {
  Add-Issue 'npm non è disponibile.'
}

# Git
if (Test-Command 'git') {
  Write-Host "  Git: $(git --version)"
} else {
  Add-Issue 'Git non è disponibile.'
}

# Package manager del progetto
$usePnpm = $false
$useYarn = $false
if (Test-Path '.\pnpm-lock.yaml') { $usePnpm = $true }
if (Test-Path '.\yarn.lock') { $useYarn = $true }

$packageManager = 'npm'
if ($usePnpm) { $packageManager = 'pnpm' }
if ($useYarn) { $packageManager = 'yarn' }

Write-Host "  Package manager rilevato: $packageManager"

if ($packageManager -eq 'pnpm' -and -not (Test-Command 'pnpm')) {
  Add-Issue 'Il progetto usa pnpm, ma pnpm non è installato.'
}

if ($packageManager -eq 'yarn' -and -not (Test-Command 'yarn')) {
  Add-Issue 'Il progetto usa yarn, ma yarn non è installato.'
}

Write-Section '2. File di progetto'

$requiredFiles = @('package.json')
foreach ($file in $requiredFiles) {
  if (Test-Path $file) {
    Write-Host "  Presente: $file"
  } else {
    Add-Issue "File obbligatorio mancante: $file"
  }
}

if (Test-Path '.env') {
  Write-Host "  Presente: .env"
} else {
  Write-Host "  .env non presente: normale se il progetto non usa variabili d'ambiente."
}

# Controllo configurazioni PostCSS duplicate
$postcssFiles = Get-ChildItem -Path . -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^postcss\.config\.(mjs|js|cjs)$|^\.postcssrc' }

if ($postcssFiles.Count -gt 1) {
  Add-Issue "Trovate $($postcssFiles.Count) configurazioni PostCSS: possibile conflitto."
  $postcssFiles | ForEach-Object { Write-Host "    - $($_.Name)" }
}

Write-Section '3. Dipendenze e versioni'

if (Test-Path '.\package.json') {
  $packageJson = Get-Content '.\package.json' -Raw | ConvertFrom-Json

  $dependencies = @()
  if ($packageJson.dependencies) { $dependencies += $packageJson.dependencies.PSObject.Properties }
  if ($packageJson.devDependencies) { $dependencies += $packageJson.devDependencies.PSObject.Properties }

  $badVersions = @()

  foreach ($dependency in $dependencies) {
    $name = $dependency.Name
    $requested = $dependency.Value

    # Salta alias, file locali, GitHub e tag non numerici
    if ($requested -match '^(file:|link:|workspace:|github:|git\+|http)') { continue }

    try {
      $available = npm view $name version --json 2>$null | ConvertFrom-Json
      if (-not $available) {
        $badVersions += "$name@$requested"
        continue
      }

      # Se la versione richiesta è un range, npm view restituisce latest: non è un errore.
      # Se è una versione esatta, verifichiamo che esista.
      if ($requested -match '^\d+\.\d+\.\d+$') {
        $exists = npm view "$name@$requested" version 2>$null
        if (-not $exists) {
          $badVersions += "$name@$requested"
        }
      }
    } catch {
      $badVersions += "$name@$requested (non verificabile)"
    }
  }

  if ($badVersions.Count -gt 0) {
    Add-Issue 'Versioni di pacchetti non valide o non verificabili:'
    $badVersions | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
  } else {
    Write-Host '  Tutte le dipendenze dichiarate sono verificabili sul registry npm.'
  }

  # Dipendenze native potenzialmente problematiche
  $nativeRiskPackages = @('better-sqlite3', 'sqlite3', 'canvas', 'sharp', 'node-gyp')
  foreach ($risk in $nativeRiskPackages) {
    $found = $dependencies | Where-Object { $_.Name -eq $risk }
    if ($found) {
      Write-Host "  [ATTENZIONE] '$risk' richiede o può richiedere compilazione nativa." -ForegroundColor Yellow
      Write-Host "               Su Windows possono servire Visual Studio Build Tools / C++ workload."
    }
  }
}

Write-Section '4. Porta $Port e processi dev'

$portProcess = Get-PortProcess -Port $Port

if ($portProcess) {
  Write-Host "  Porta $Port occupata da PID $($portProcess.Pid) ($($portProcess.Name))." -ForegroundColor Yellow

  if ($portProcess.Name -eq 'node') {
    Write-Host "  Processo Node rilevato. NON viene terminato automaticamente." -ForegroundColor Yellow
    Write-Host "  Per liberare la porta manualmente:"
    Write-Host "    Stop-Process -Id $($portProcess.Pid) -Force"
  } else {
    Write-Host "  Il processo non è Node: non viene toccato." -ForegroundColor Yellow
  }
} else {
  Write-Host "  Porta $Port libera."
}

Write-Section '5. Installazione dipendenze'

if ($Fix) {
  if ($packageManager -eq 'npm') {
    Write-Host '  Esecuzione: npm install'
    npm install
    if ($LASTEXITCODE -eq 0) {
      Add-Fixed 'Dipendenze npm installate/aggiornate.'
    } else {
      Add-Issue "npm install è fallito con codice $LASTEXITCODE. Leggere l'errore completo prima di riprovare."
    }
  } elseif ($packageManager -eq 'pnpm') {
    Write-Host '  Esecuzione: pnpm install'
    pnpm install
    if ($LASTEXITCODE -eq 0) { Add-Fixed 'Dipendenze pnpm installate/aggiornate.' }
    else { Add-Issue "pnpm install è fallito con codice $LASTEXITCODE." }
  } elseif ($packageManager -eq 'yarn') {
    Write-Host '  Esecuzione: yarn install'
    yarn install
    if ($LASTEXITCODE -eq 0) { Add-Fixed 'Dipendenze yarn installate/aggiornate.' }
    else { Add-Issue "yarn install è fallito con codice $LASTEXITCODE." }
  }
} else {
  Write-Host '  Modalità diagnosi: installazione non eseguita. Usa -Fix per installare.'
}

Write-Section '6. Build e lint'

if (-not $SkipBuild) {
  if (Test-Path '.\package.json') {
    $scripts = (Get-Content '.\package.json' -Raw | ConvertFrom-Json).scripts

    if ($scripts.build) {
      if ($Fix) {
        Write-Host '  Esecuzione: build'
        if ($packageManager -eq 'npm') { npm run build }
        elseif ($packageManager -eq 'pnpm') { pnpm run build }
        else { yarn build }

        if ($LASTEXITCODE -eq 0) { Add-Fixed 'Build completata.' }
        else { Add-Issue "Build fallita con codice $LASTEXITCODE." }
      } else {
        Write-Host '  Build disponibile ma non eseguita in modalità diagnosi.'
      }
    }

    if ($scripts.lint) {
      if ($Fix) {
        Write-Host '  Esecuzione: lint'
        if ($packageManager -eq 'npm') { npm run lint }
        elseif ($packageManager -eq 'pnpm') { pnpm run lint }
        else { yarn lint }

        if ($LASTEXITCODE -eq 0) { Add-Fixed 'Lint completato.' }
        else { Add-Issue "Lint fallito con codice $LASTEXITCODE." }
      } else {
        Write-Host '  Lint disponibile ma non eseguito in modalità diagnosi.'
      }
    }
  }
} else {
  Write-Host '  Build e lint saltati (-SkipBuild).'
}

Write-Section '7. Toolchain native opzionali'

if ($InstallBuildTools) {
  Write-Host '  Verifica/installazione Visual Studio Build Tools tramite winget...'
  if (Test-Command 'winget') {
    winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
      Add-Fixed 'Visual Studio Build Tools installato/verificato.'
    } else {
      Add-Issue 'Installazione Build Tools non completata.'
    }
  } else {
    Add-Issue 'winget non disponibile: installare Visual Studio Build Tools manualmente.'
  }
} else {
  Write-Host '  Controllo toolchain native saltato. Usa -InstallBuildTools solo se un pacchetto nativo lo richiede.'
}

Write-Section 'Riepilogo'

if ($script:Fixed.Count -gt 0) {
  Write-Host 'Azioni completate:' -ForegroundColor Green
  $script:Fixed | ForEach-Object { Write-Host "  - $_" }
}

if ($script:Issues.Count -eq 0) {
  Write-Host ''
  Write-Host 'Nessun problema bloccante rilevato.' -ForegroundColor Green
  exit 0
} else {
  Write-Host ''
  Write-Host "Problemi rilevati: $($script:Issues.Count)" -ForegroundColor Red
  $script:Issues | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
