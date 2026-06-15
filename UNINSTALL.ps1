# MarchesPublics AI - Desinstallateur

$AppName = "MarchesPublicsAI"
$AppDir = "$env:LOCALAPPDATA\$AppName"

Write-Host ""
Write-Host "  MarchesPublics AI -- Desinstallation" -ForegroundColor Yellow
Write-Host "  ======================================" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "  Supprimer MarchesPublics AI ? (o/n)"
if ($confirm -ne 'o') {
    Write-Host "  Annule." -ForegroundColor Gray
    exit 0
}

# -- Fermeture de l'application si elle tourne --
$electronPath = "$AppDir\electron-bin\electron.exe"
$processes = Get-Process -Name "electron" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -eq $electronPath
}
if (-not $processes) {
    # Fallback: chercher par chemin partiel
    $processes = Get-Process -Name "electron" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*$AppName*"
    }
}
if ($processes) {
    Write-Host "  Fermeture de l'application en cours..." -ForegroundColor Cyan
    $processes | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "  OK Application fermee" -ForegroundColor Green
}

# -- Raccourci Bureau --
$WShell = New-Object -ComObject WScript.Shell
$Desktop = $WShell.SpecialFolders("Desktop")
$Shortcut = "$Desktop\MarchesPublics AI.lnk"
if (Test-Path $Shortcut) {
    Remove-Item $Shortcut -Force
    Write-Host "  OK Raccourci Bureau supprime" -ForegroundColor Green
}

# -- Dossier app (electron-bin + node_modules + fichiers) --
if (Test-Path $AppDir) {
    # Tenter la suppression normale
    try {
        Remove-Item $AppDir -Recurse -Force -ErrorAction Stop
        Write-Host "  OK Dossier application supprime ($AppDir)" -ForegroundColor Green
    } catch {
        # Si des fichiers sont encore verrouilles, forcer via robocopy (vide vers cible, puis supprime)
        Write-Host "  Suppression forcee en cours..." -ForegroundColor Cyan
        $emptyDir = "$env:TEMP\empty_$AppName"
        New-Item -ItemType Directory -Force -Path $emptyDir | Out-Null
        robocopy $emptyDir $AppDir /MIR /R:2 /W:1 /NP /NFL /NDL /NJH /NJS | Out-Null
        Remove-Item $emptyDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $AppDir -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $AppDir) {
            Write-Host "  AVERTISSEMENT: Certains fichiers n'ont pas pu etre supprimes." -ForegroundColor Yellow
            Write-Host "  Redemarrez Windows et relancez ce script pour terminer." -ForegroundColor Yellow
        } else {
            Write-Host "  OK Dossier application supprime ($AppDir)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  -- Dossier application introuvable (deja supprime?)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Desinstallation terminee." -ForegroundColor Green
Write-Host "  Node.js n'a pas ete touche." -ForegroundColor Gray
Write-Host ""
Read-Host "  Appuyez sur Entree pour fermer"
