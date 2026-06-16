# MarchesPublics AI - Installateur Windows
# Encodage: ASCII uniquement pour compatibilite PowerShell

$ErrorActionPreference = "Stop"
$AppName = "MarchesPublicsAI"
$AppDir = "$env:LOCALAPPDATA\$AppName"
$ElectronVersion = "36.3.1"
$ElectronZipUrl = "https://github.com/electron/electron/releases/download/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip"
$ElectronDir = "$AppDir\electron-bin"
$ElectronExe = "$ElectronDir\electron.exe"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

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

# -- 3. Sauvegarder le chemin source pour la synchronisation automatique --
Set-Content "$AppDir\source_path.txt" $ScriptDir -Encoding UTF8
Write-Host "  OK Chemin source enregistre" -ForegroundColor Green

# -- 4. Copier les fichiers sources --
foreach ($f in @("main.js", "preload.js", "index.html", "package.json")) {
    $src = Join-Path $ScriptDir $f
    if (Test-Path $src) { Copy-Item $src "$AppDir\$f" -Force }
}
$srcAssets = Join-Path $ScriptDir "assets"
if (Test-Path $srcAssets) {
    $dstAssets = Join-Path $AppDir "assets"
    if (-not (Test-Path $dstAssets)) { New-Item -ItemType Directory -Path $dstAssets | Out-Null }
    robocopy $srcAssets $dstAssets /MIR /R:1 /W:1 /NP /NFL /NDL /NJH /NJS | Out-Null
}
Write-Host "  OK Fichiers copies" -ForegroundColor Green

# -- 5. Installer axios + cheerio --
Set-Location $AppDir
$env:NPM_CONFIG_LOGLEVEL = "error"

if (-not (Test-Path "$AppDir\node_modules\axios")) {
    Write-Host "  Installation des modules Node..." -ForegroundColor Cyan
    cmd /c "npm install axios cheerio --loglevel=error 2>nul"
    Write-Host "  OK Modules installes" -ForegroundColor Green
} else {
    Write-Host "  OK Modules deja installes" -ForegroundColor Green
}

# -- 6. Telecharger Electron --
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

# -- 7. Generer launch.ps1 avec synchronisation automatique --
$launchContent = @'
# Lance MarchesPublics AI en synchronisant les fichiers sources si modifies

$AppDir = $PSScriptRoot
$ElectronExe = "$AppDir\electron-bin\electron.exe"
$SourcePath = (Get-Content "$AppDir\source_path.txt" -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()

if ($SourcePath -and (Test-Path $SourcePath)) {
    $synced = @()
    foreach ($f in @("main.js", "preload.js", "index.html", "package.json")) {
        $src = Join-Path $SourcePath $f
        $dst = Join-Path $AppDir $f
        if (Test-Path $src) {
            $srcTime = (Get-Item $src).LastWriteTime
            $dstTime = if (Test-Path $dst) { (Get-Item $dst).LastWriteTime } else { [DateTime]::MinValue }
            if ($srcTime -gt $dstTime) {
                Copy-Item $src $dst -Force
                $synced += $f
            }
        }
    }
    $srcAssets = Join-Path $SourcePath "assets"
    $dstAssets = Join-Path $AppDir "assets"
    if (Test-Path $srcAssets) {
        if (-not (Test-Path $dstAssets)) { New-Item -ItemType Directory -Path $dstAssets | Out-Null }
        $robocopyOut = robocopy $srcAssets $dstAssets /MIR /R:1 /W:1 /NP /NFL /NDL /NJH /NJS
        if ($LASTEXITCODE -ge 1 -and $LASTEXITCODE -le 7) { $synced += "assets/" }
    }
    if ($synced.Count -gt 0) {
        Write-Host "  Synchro: $($synced -join ', ')" -ForegroundColor Cyan
    }
}

Start-Process $ElectronExe -ArgumentList $AppDir -WorkingDirectory $AppDir
'@
Set-Content "$AppDir\launch.ps1" $launchContent -Encoding UTF8
Write-Host "  OK Lanceur avec synchro automatique cree" -ForegroundColor Green

# -- 8. Raccourci Bureau --
$WShell = New-Object -ComObject WScript.Shell
$Desktop = $WShell.SpecialFolders("Desktop")
$DesktopShortcut = "$Desktop\MarchesPublics AI.lnk"
$SC = $WShell.CreateShortcut($DesktopShortcut)
$SC.TargetPath = "powershell.exe"
$SC.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$AppDir\launch.ps1`""
$SC.WorkingDirectory = $AppDir
$SC.Description = "MarchesPublics AI"
$IconPath = "$AppDir\assets\icon.ico"
if (Test-Path $IconPath) { $SC.IconLocation = "$IconPath,0" }
$SC.Save()
Write-Host "  OK Raccourci Bureau mis a jour" -ForegroundColor Green

# -- 9. Lancer --
Write-Host ""
Write-Host "  Installation terminee!" -ForegroundColor Green
Write-Host "  Lancement de MarchesPublics AI..." -ForegroundColor Cyan
Write-Host ""

Start-Process $ElectronExe -ArgumentList $AppDir -WorkingDirectory $AppDir
