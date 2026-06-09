<#
install-client-vscode.ps1
Run this from the extracted app folder in VS Code to install to C:\KiryanaPOS and create a Desktop shortcut.
#>
param(
    [string]$InstallPath = "C:\KiryanaPOS",
    [int]$Port = 3000
)

$SourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Source path: $SourcePath" -ForegroundColor Cyan
Write-Host "Install path: $InstallPath" -ForegroundColor Cyan

# Copy files if needed
if ($SourcePath -ne $InstallPath) {
    Write-Host "Copying app files to $InstallPath..." -ForegroundColor Yellow
    try {
        if (-not (Test-Path $InstallPath)) {
            New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        }
        Copy-Item -Path (Join-Path $SourcePath '*') -Destination $InstallPath -Recurse -Force -ErrorAction Stop
        Write-Host "Files copied to $InstallPath." -ForegroundColor Green
    } catch {
        Write-Host "Failed to copy files: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Source is already the install folder; no copy needed." -ForegroundColor Green
}

# Determine desktop locations
$userDesktop = [Environment]::GetFolderPath('Desktop')
$commonDesktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
$shortcutTarget = Join-Path $InstallPath 'Start-Kiryana.bat'

function Create-Shortcut($path) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = $shortcutTarget
    $shortcut.WorkingDirectory = $InstallPath
    $iconCandidate = Join-Path $InstallPath 'logo\favicon.ico'
    if (Test-Path $iconCandidate) { $shortcut.IconLocation = $iconCandidate }
    $shortcut.Save()
}

$isAdmin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    try {
        $publicShortcut = Join-Path $commonDesktop 'Kiryana POS.lnk'
        Create-Shortcut $publicShortcut
        Write-Host "Created public Desktop shortcut: $publicShortcut" -ForegroundColor Green
    } catch {
        Write-Host "Failed to create public Desktop shortcut: $_" -ForegroundColor Yellow
    }
}

try {
    $userShortcut = Join-Path $userDesktop 'Kiryana POS.lnk'
    Create-Shortcut $userShortcut
    Write-Host "Created user Desktop shortcut: $userShortcut" -ForegroundColor Green
} catch {
    Write-Host "Failed to create user Desktop shortcut: $_" -ForegroundColor Red
    exit 1
}

if ($isAdmin) {
    try {
        $existing = Get-NetFirewallRule -DisplayName "KiryanaPOS HTTP" -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-NetFirewallRule -DisplayName "KiryanaPOS HTTP" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile Any -ErrorAction Stop
            Write-Host "Firewall rule added for port $Port." -ForegroundColor Green
        } else {
            Write-Host "Firewall rule already exists." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Failed to add firewall rule: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "Not running as Administrator: firewall rule was not added." -ForegroundColor Yellow
}

Write-Host "Installation complete. Double-click the Desktop shortcut to start Kiryana POS." -ForegroundColor Cyan
Write-Host "If the browser does not open automatically, run Start-Kiryana.bat from $InstallPath." -ForegroundColor Cyan
