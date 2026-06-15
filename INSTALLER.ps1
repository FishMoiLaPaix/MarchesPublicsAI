# MarchesPublics AI - Installateur Windows
# Encodage: ASCII uniquement pour compatibilite PowerShell

$ErrorActionPreference = "Stop"
$AppName = "MarchesPublicsAI"
$AppDir = "$env:LOCALAPPDATA\$AppName"
$ElectronVersion = "36.3.1"
$ElectronZipUrl = "https://github.com/electron/electron/releases/download/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip"
$ElectronDir = "$AppDir\electron-bin"
$ElectronExe = "$ElectronDir\electron.exe"

Write-Host ""
Write-Host "  MarchesPublics AI -- Installation" -ForegroundColor Cyan
Write-Host "  ===================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Verifier Node.js --
function Test-NodeVersion {
    try {
        $v = (node --version 2>$null).TrimStart('v')
        return [int]($v.Split('.')[0]) -ge 18
    } catch { return $false }
}

if (-not (Test-NodeVersion)) {
    Write-Host "  ATTENTION: Node.js 18+ est requis." -ForegroundColor Yellow
    Write-Host "  Telechargez-le sur https://nodejs.org" -ForegroundColor Yellow
    $open = Read-Host "  Ouvrir le site maintenant? (o/n)"
    if ($open -eq 'o') { Start-Process "https://nodejs.org/en/download" }
    Read-Host "  Appuyez sur Entree apres l'installation..."
    if (-not (Test-NodeVersion)) {
        Write-Host "  ERREUR: Node.js non detecte." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  OK Node.js detecte" -ForegroundColor Green

# -- 2. Creer le dossier app --
if (-not (Test-Path $AppDir)) {
    New-Item -ItemType Directory -Path $AppDir | Out-Null
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($f in @("main.js", "preload.js", "index.html", "package.json")) {
    $src = Join-Path $ScriptDir $f
    if (Test-Path $src) { Copy-Item $src "$AppDir\$f" -Force }
}

# -- 3. Installer axios + cheerio (pas Electron via npm) --
Set-Location $AppDir
$env:NPM_CONFIG_LOGLEVEL = "error"

if (-not (Test-Path "$AppDir\node_modules\axios")) {
    Write-Host "  Installation des modules Node..." -ForegroundColor Cyan
    cmd /c "npm install axios cheerio --loglevel=error 2>nul"
    Write-Host "  OK Modules installes" -ForegroundColor Green
} else {
    Write-Host "  OK Modules deja installes" -ForegroundColor Green
}

# -- 4. Telecharger Electron directement depuis GitHub --
if (-not (Test-Path $ElectronExe)) {
    Write-Host "  Telechargement Electron v$ElectronVersion..." -ForegroundColor Cyan
    $ZipPath = "$env:TEMP\electron-$ElectronVersion.zip"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "MarchesPublicsAI-Installer")
        $wc.DownloadFile($ElectronZipUrl, $ZipPath)
    } catch {
        Write-Host "  ERREUR: Impossible de telecharger Electron." -ForegroundColor Red
        Write-Host "  Cause: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Telechargez manuellement:" -ForegroundColor Yellow
        Write-Host "  $ElectronZipUrl" -ForegroundColor Yellow
        Write-Host "  Extrayez dans: $ElectronDir" -ForegroundColor Yellow
        Read-Host "  Entree pour fermer"
        exit 1
    }

    Write-Host "  Extraction..." -ForegroundColor Cyan
    if (Test-Path $ElectronDir) { Remove-Item $ElectronDir -Recurse -Force }
    New-Item -ItemType Directory -Path $ElectronDir | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $ElectronDir -Force
    Remove-Item $ZipPath -Force
    Write-Host "  OK Electron installe" -ForegroundColor Green
} else {
    Write-Host "  OK Electron deja present" -ForegroundColor Green
}

# -- 5. Creer launch.ps1 --
$launchScript = "Start-Process `"$ElectronExe`" -ArgumentList `"$AppDir`" -WorkingDirectory `"$AppDir`""
Set-Content "$AppDir\launch.ps1" $launchScript -Encoding UTF8

# -- 6. Raccourci Bureau --
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

# -- 7. Lancer --
Write-Host ""
Write-Host "  Installation terminee!" -ForegroundColor Green
Write-Host "  Lancement de MarchesPublics AI..." -ForegroundColor Cyan
Write-Host ""

Start-Process $ElectronExe -ArgumentList $AppDir -WorkingDirectory $AppDir
