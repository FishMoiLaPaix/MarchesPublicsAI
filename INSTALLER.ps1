# MarchesPublics AI - Installateur Windows
# Encodage: ASCII uniquement pour compatibilite PowerShell

$ErrorActionPreference = "Stop"
$AppName = "MarchesPublicsAI"
$AppDir = "$env:LOCALAPPDATA\$AppName"

Write-Host ""
Write-Host "  MarchesPublics AI -- Installation" -ForegroundColor Cyan
Write-Host "  ===================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Verifier Node.js --
function Test-NodeVersion {
    try {
        $v = (node --version 2>$null).TrimStart('v')
        $parts = $v.Split('.')
        return [int]$parts[0] -ge 18
    } catch { return $false }
}

if (-not (Test-NodeVersion)) {
    Write-Host "  ATTENTION: Node.js 18+ est requis." -ForegroundColor Yellow
    Write-Host "  Telechargez-le sur https://nodejs.org" -ForegroundColor Yellow
    Write-Host ""
    $open = Read-Host "  Ouvrir le site maintenant? (o/n)"
    if ($open -eq 'o') { Start-Process "https://nodejs.org/en/download" }
    Read-Host "  Appuyez sur Entree apres l'installation de Node.js..."
    if (-not (Test-NodeVersion)) {
        Write-Host "  ERREUR: Node.js non detecte. Abandon." -ForegroundColor Red
        exit 1
    }
}

Write-Host "  OK Node.js detecte" -ForegroundColor Green

# -- 2. Creer le dossier app --
if (-not (Test-Path $AppDir)) {
    New-Item -ItemType Directory -Path $AppDir | Out-Null
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$files = @("main.js", "preload.js", "index.html", "package.json")
foreach ($f in $files) {
    $src = Join-Path $ScriptDir $f
    $dst = Join-Path $AppDir $f
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
    }
}

# -- 3. Installer les dependances --
Set-Location $AppDir

if (-not (Test-Path "$AppDir\node_modules\electron")) {
    Write-Host "  Installation des dependances (premiere fois ~2 min)..." -ForegroundColor Cyan
    $env:NPM_CONFIG_LOGLEVEL = "error"
    cmd /c "npm install --save-dev electron --loglevel=error 2>nul"
    cmd /c "npm install axios cheerio --loglevel=error 2>nul"
    Write-Host "  OK Dependances installees" -ForegroundColor Green
} else {
    Write-Host "  OK Dependances deja installees" -ForegroundColor Green
}

# -- 4. Creer le raccourci Bureau --
$WShell = New-Object -ComObject WScript.Shell
$Desktop = $WShell.SpecialFolders("Desktop")
$DesktopShortcut = "$Desktop\MarchesPublics AI.lnk"
if (-not (Test-Path $DesktopShortcut)) {
    $SC = $WShell.CreateShortcut($DesktopShortcut)
    $SC.TargetPath = "powershell.exe"
    $SC.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$AppDir\launch.ps1`""
    $SC.WorkingDirectory = $AppDir
    $SC.Description = "MarchesPublics AI"
    $SC.Save()
    Write-Host "  OK Raccourci cree sur le Bureau" -ForegroundColor Green
}

# -- 5. Creer launch.ps1 --
$launchScript = "Set-Location `"$AppDir`"`nnpx electron . 2>`$null"
Set-Content "$AppDir\launch.ps1" $launchScript -Encoding UTF8

# -- 6. Lancer l'application --
Write-Host ""
Write-Host "  Installation terminee!" -ForegroundColor Green
Write-Host "  Lancement de MarchesPublics AI..." -ForegroundColor Cyan
Write-Host ""

npx electron .
