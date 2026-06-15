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
    Remove-Item $AppDir -Recurse -Force
    Write-Host "  OK Dossier application supprime ($AppDir)" -ForegroundColor Green
} else {
    Write-Host "  -- Dossier application introuvable (deja supprime?)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Desinstallation terminee." -ForegroundColor Green
Write-Host "  Node.js n'a pas ete touche." -ForegroundColor Gray
Write-Host ""
Read-Host "  Appuyez sur Entree pour fermer"
