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

# -- 8. Raccourcis (Bureau + Menu Demarrer) avec AppUserModelID --
# L'AppUserModelID (identique a APP_USER_MODEL_ID dans main.js) permet a Windows
# d'epingler l'app sous SA propre icone (icon.ico) et non sous celle d'electron.exe
# (le lanceur reel). WScript.Shell ne sait pas poser l'AUMID, donc on cree le
# raccourci via IShellLink + IPropertyStore (PROPVARIANT construite a la main).
$AppId = "com.marchespublics.ai"
$IconPath = "$AppDir\assets\icon.ico"
$LaunchArgs = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$AppDir\launch.ps1`""

$shortcutCs = @'
using System;
using System.Runtime.InteropServices;
namespace MpaShortcut {
  [StructLayout(LayoutKind.Sequential)] public struct PROPERTYKEY { public Guid fmtid; public uint pid; }
  [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder f, int c, IntPtr fd, uint fl);
    void GetIDList(out IntPtr ppidl); void SetIDList(IntPtr pidl);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder s, int c);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder d, int c);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string d);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder a, int c);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string a);
    void GetHotkey(out short h); void SetHotkey(short h);
    void GetShowCmd(out int c); void SetShowCmd(int c);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder i, int c, out int idx);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string i, int idx);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string p, uint r);
    void Resolve(IntPtr hwnd, uint f); void SetPath([MarshalAs(UnmanagedType.LPWStr)] string p);
  }
  [ComImport, Guid("0000010b-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPersistFile { void GetClassID(out Guid c); [PreserveSig] int IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string f, uint m);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string f, [MarshalAs(UnmanagedType.Bool)] bool r);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string f); void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string f); }
  [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPropertyStore { void GetCount(out uint c); void GetAt(uint i, out PROPERTYKEY k);
    void GetValue(ref PROPERTYKEY k, IntPtr pv); void SetValue(ref PROPERTYKEY k, IntPtr pv); void Commit(); }
  [ComImport, Guid("00021401-0000-0000-C000-000000000046")] public class CShellLink { }
  public static class Maker {
    static PROPERTYKEY AUMID = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
    public static void Create(string lnk, string target, string args, string workDir, string desc, string iconPath, int iconIdx, string appId) {
      var o = new CShellLink(); var sl = (IShellLinkW)o;
      sl.SetPath(target);
      if (args != null) sl.SetArguments(args);
      if (workDir != null) sl.SetWorkingDirectory(workDir);
      if (desc != null) sl.SetDescription(desc);
      if (iconPath != null) sl.SetIconLocation(iconPath, iconIdx);
      if (appId != null) {
        IntPtr pv = Marshal.AllocCoTaskMem(16);
        for (int i = 0; i < 16; i++) Marshal.WriteByte(pv, i, 0);
        Marshal.WriteInt16(pv, 0, 31);
        Marshal.WriteIntPtr(pv, 8, Marshal.StringToCoTaskMemUni(appId));
        var ps = (IPropertyStore)o; var k = AUMID; ps.SetValue(ref k, pv); ps.Commit();
      }
      ((IPersistFile)o).Save(lnk, true);
      Marshal.ReleaseComObject(o);
    }
  }
}
'@
$haveMaker = $false
try { Add-Type -TypeDefinition $shortcutCs -Language CSharp -ErrorAction Stop; $haveMaker = $true } catch { $haveMaker = $false }

function New-MpaShortcut($Path) {
    $done = $false
    if ($haveMaker) {
        try {
            $icon = if (Test-Path $IconPath) { $IconPath } else { $null }
            [MpaShortcut.Maker]::Create($Path, "powershell.exe", $LaunchArgs, $AppDir, "MarchesPublics AI", $icon, 0, $AppId)
            $done = $true
        } catch { $done = $false }
    }
    if (-not $done) {
        # Repli : raccourci classique sans AUMID (l'icone d'epinglage peut alors etre celle d'Electron)
        $w = New-Object -ComObject WScript.Shell
        $s = $w.CreateShortcut($Path)
        $s.TargetPath = "powershell.exe"
        $s.Arguments = $LaunchArgs
        $s.WorkingDirectory = $AppDir
        $s.Description = "MarchesPublics AI"
        if (Test-Path $IconPath) { $s.IconLocation = "$IconPath,0" }
        $s.Save()
    }
}

$Desktop = (New-Object -ComObject WScript.Shell).SpecialFolders("Desktop")
New-MpaShortcut "$Desktop\MarchesPublics AI.lnk"
$StartMenu = [Environment]::GetFolderPath('Programs')
New-MpaShortcut "$StartMenu\MarchesPublics AI.lnk"
Write-Host "  OK Raccourcis Bureau + Menu Demarrer crees" -ForegroundColor Green

# -- 9. Lancer --
Write-Host ""
Write-Host "  Installation terminee!" -ForegroundColor Green
Write-Host "  Lancement de MarchesPublics AI..." -ForegroundColor Cyan
Write-Host ""

Start-Process $ElectronExe -ArgumentList $AppDir -WorkingDirectory $AppDir
