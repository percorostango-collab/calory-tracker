<#
.SYNOPSIS
  Preflight universale: profilo ambiente e blocco preventivo prima che l'agente inizi a lavorare.

.DESCRIPTION
  Script read-only, pensato per essere eseguito AUTOMATICAMENTE da un hook Claude Code
  prima di npm install, pnpm install, yarn install, modifiche a package.json,
  postcss.config.* o avvio del dev server.

  Non installa nulla, non modifica file e non termina processi.
  Esce con:
    0 = ambiente noto, nessun blocco
    2 = blocco/precondizione mancante: l'agente deve fermarsi e correggere il piano

.USAGE
  .\preflight.ps1
  .\preflight.ps1 -Port 3000
  .\preflight.ps1 -Json
#>

param(
  [int]$Port = 3000,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

$report = [ordered]@{
  timestamp = (Get-Date).ToString('o')
  projectRoot = (Get-Location).Path
  status = 'BLOCKED'
  blockers = @()
  warnings = @()
  environment = [ordered]@{}
  project = [ordered]@{}
  port = [ordered]@{}
  dependencies = [ordered]@{}
}

function Add-Blocker($message) {
  $report.blockers += $message
}

function Add-Warning($message) {
  $report.warnings += $message
}

function Get-CommandVersion($command) {
  $cmd = Get-Command $command -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  try {
    return (& $command --version 2>$null | Select-Object -First 1)
  } catch {
    return 'versione non leggibile'
  }
}

# 1. Ambiente
$report.environment.os = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'windows' } else { 'sconosciuto' }
$report.environment.node = Get-CommandVersion 'node'
$report.environment.npm = Get-CommandVersion 'npm'
$report.environment.git = Get-CommandVersion 'git'
$report.environment.pnpm = Get-CommandVersion 'pnpm'
$report.environment.yarn = Get-CommandVersion 'yarn'

if (-not $report.environment.node) {
  Add-Blocker 'Node.js non disponibile: non avviare scaffolding, installazioni o generazione di package.json.'
}

if (-not $report.environment.npm) {
  Add-Blocker 'npm non disponibile: non avviare installazioni o progetti Node.'
}

# 2. Package manager dal lockfile
$packageManager = 'npm'
if (Test-Path '.\pnpm-lock.yaml') { $packageManager = 'pnpm' }
elseif (Test-Path '.\yarn.lock') { $packageManager = 'yarn' }

$report.project.packageManager = $packageManager

if ($packageManager -eq 'pnpm' -and -not (Get-Command 'pnpm' -ErrorAction SilentlyContinue)) {
  Add-Blocker 'Il progetto contiene pnpm-lock.yaml ma pnpm non è installato.'
}

if ($packageManager -eq 'yarn' -and -not (Get-Command 'yarn' -ErrorAction SilentlyContinue)) {
  Add-Blocker 'Il progetto contiene yarn.lock ma yarn non è installato.'
}

# 3. Stato progetto
$report.project.hasPackageJson = [bool](Test-Path '.\package.json')
$report.project.hasNodeModules = [bool](Test-Path '.\node_modules')
$report.project.hasLockfile = [bool]((Test-Path '.\package-lock.json') -or (Test-Path '.\pnpm-lock.yaml') -or (Test-Path '.\yarn.lock'))

# Configurazioni PostCSS duplicate
$postcssFiles = Get-ChildItem -Path . -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^postcss\.config\.(mjs|js|cjs)$|^\.postcssrc' }

$report.project.postcssFiles = @($postcssFiles | ForEach-Object { $_.Name })

if ($postcssFiles.Count -gt 1) {
  Add-Blocker 'Trovate più configurazioni PostCSS: rimuovere/consolidare prima di continuare.'
}

# Tailwind v4: se usato, il plugin PostCSS deve essere installato
if (Test-Path '.\package.json') {
  $pkg = Get-Content '.\package.json' -Raw | ConvertFrom-Json
  $allDeps = @()
  if ($pkg.dependencies) { $allDeps += $pkg.dependencies.PSObject.Properties }
  if ($pkg.devDependencies) { $allDeps += $pkg.devDependencies.PSObject.Properties }

  $tailwind = $allDeps | Where-Object { $_.Name -eq 'tailwindcss' }
  $tailwindPostcss = $allDeps | Where-Object { $_.Name -eq '@tailwindcss/postcss' }

  if ($tailwind -and -not $tailwindPostcss) {
    Add-Blocker 'tailwindcss è dichiarato ma @tailwindcss/postcss non è presente: non avviare il dev server né modificare il CSS.'
  }

  if ($tailwindPostcss -and -not (Test-Path '.\node_modules\@tailwindcss\postcss')) {
    Add-Blocker '@tailwindcss/postcss è dichiarato ma non risulta installato in node_modules.'
  }

  # Dipendenze native: non blocca, ma impone verifica prima dell'installazione
  $nativeRisk = @('better-sqlite3', 'sqlite3', 'canvas', 'sharp', 'node-gyp', 'bcrypt')
  foreach ($name in $nativeRisk) {
    $found = $allDeps | Where-Object { $_.Name -eq $name }
    if ($found) {
      Add-Warning "Dipendenza nativa rilevata: $name. Verificare prebuilt binary per OS/architettura/Node prima dell'installazione."
    }
  }

  # Versioni esatte non presenti sul registry
  $invalidVersions = @()
  foreach ($dep in $allDeps) {
    $name = $dep.Name
    $requested = [string]$dep.Value

    if ($requested -match '^(file:|link:|workspace:|github:|git\+|http)') { continue }
    if ($requested -notmatch '^\d+\.\d+\.\d+$') { continue }

    $exists = npm view "$name@$requested" version 2>$null
    if (-not $exists) {
      $invalidVersions += "$name@$requested"
    }
  }

  $report.dependencies.invalidExactVersions = $invalidVersions

  if ($invalidVersions.Count -gt 0) {
    Add-Blocker 'Versioni esatte non presenti sul registry npm. Correggere package.json prima di installare.'
  }
}

# 4. Porta dev server
$connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($connection) {
  $proc = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
  $report.port.available = $false
  $report.port.pid = $connection.OwningProcess
  $report.port.process = if ($proc) { $proc.ProcessName } else { 'sconosciuto' }

  Add-Warning "Porta $Port occupata da PID $($report.port.pid). Non avviare un secondo dev server sulla stessa porta."
} else {
  $report.port.available = $true
  $report.port.pid = $null
  $report.port.process = $null
}

# 5. Esito
if ($report.blockers.Count -eq 0) {
  $report.status = 'READY'
} else {
  $report.status = 'BLOCKED'
}

if ($Json) {
  $report | ConvertTo-Json -Depth 6 | Write-Output
  if ($report.status -eq 'BLOCKED') { exit 2 } else { exit 0 }
}

Write-Host '=== PREFLIGHT PROGETTO ===' -ForegroundColor Cyan
Write-Host "Stato: $($report.status)" -ForegroundColor $(if ($report.status -eq 'READY') { 'Green' } else { 'Red' })
Write-Host "Cartella: $($report.projectRoot)"
Write-Host "Node: $($report.environment.node)"
Write-Host "npm: $($report.environment.npm)"
Write-Host "Git: $($report.environment.git)"
Write-Host "Package manager: $packageManager"
Write-Host "Porta $Port : $(if ($report.port.available) { 'libera' } else { "occupata da PID $($report.port.pid)" })"

if ($report.warnings.Count -gt 0) {
  Write-Host ''
  Write-Host 'Avvisi:' -ForegroundColor Yellow
  $report.warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

if ($report.blockers.Count -gt 0) {
  Write-Host ''
  Write-Host 'BLOCCHI - non procedere con installazioni, scaffolding o modifiche:' -ForegroundColor Red
  $report.blockers | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 2
}

Write-Host ''
Write-Host 'Preflight superato: si può procedere con pianificazione e implementazione.' -ForegroundColor Green
exit 0
