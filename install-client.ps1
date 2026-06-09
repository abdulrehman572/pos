<#
install-client.ps1
Usage: Run this on the client machine (as Administrator) to install the app
Example: powershell -NoProfile -ExecutionPolicy Bypass -File .\install-client.ps1
#>
param(
    [string]$SourcePath = $(Split-Path -Parent $MyInvocation.MyCommand.Path),
    [string]$InstallPath = "C:\KiryanaPOS",
    [switch]$CreateDesktopShortcut = $true,
    [int]$Port = 3000
)

Write-Host "Installing Kiryana POS from '$SourcePath' to '$InstallPath'" -ForegroundColor Cyan

# Create install dir
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Copy files
Write-Host "Copying files..." -ForegroundColor Yellow
try {
    Copy-Item -Path (Join-Path $SourcePath '*') -Destination $InstallPath -Recurse -Force -ErrorAction Stop
    Write-Host "Files copied." -ForegroundColor Green
} catch {
    Write-Host "Failed to copy files: $_" -ForegroundColor Red
    exit 1
}

# Create Desktop shortcut (Public Desktop so all users see it)
if ($CreateDesktopShortcut) {
    # Determine whether we have administrative privileges
    $isAdmin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    $created = $false
    if ($isAdmin) {
        try {
            $commonDesktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
            $lnkPath = Join-Path $commonDesktop 'Kiryana POS.lnk'
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($lnkPath)
            $shortcut.TargetPath = Join-Path $InstallPath 'Start-Kiryana.bat'
            $shortcut.WorkingDirectory = $InstallPath
            $iconCandidate = Join-Path $InstallPath 'logo\\favicon.ico'
            if (Test-Path $iconCandidate) { $shortcut.IconLocation = $iconCandidate }
            $shortcut.Save()
            Write-Host "Created desktop shortcut at $lnkPath" -ForegroundColor Green
            $created = $true
        } catch {
            Write-Host "Failed to create public desktop shortcut: $_" -ForegroundColor Yellow
        }
    }

    if (-not $created) {
        try {
            $userDesktop = [Environment]::GetFolderPath('Desktop')
            $lnkPath = Join-Path $userDesktop 'Kiryana POS.lnk'
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($lnkPath)
            $shortcut.TargetPath = Join-Path $InstallPath 'Start-Kiryana.bat'
            $shortcut.WorkingDirectory = $InstallPath
            $iconCandidate = Join-Path $InstallPath 'logo\\favicon.ico'
            if (Test-Path $iconCandidate) { $shortcut.IconLocation = $iconCandidate }
            $shortcut.Save()
            Write-Host "Created desktop shortcut at $lnkPath" -ForegroundColor Green
            $created = $true
        } catch {
            Write-Host "Failed to create user desktop shortcut: $_" -ForegroundColor Yellow
        }
    }

    if (-not $created) {
        Write-Host "Could not create a desktop shortcut. You can create one manually pointing to Start-Kiryana.bat in the install folder." -ForegroundColor Yellow
    }
}

# Add firewall rule to allow the app port (only when elevated)
$isAdmin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Not running as Administrator: skipping firewall rule creation. Run the script elevated to add the firewall rule automatically." -ForegroundColor Yellow
} else {
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
}

Write-Host "Installation complete." -ForegroundColor Cyan
Write-Host "Double-click the 'Kiryana POS' shortcut on the Desktop to start the server and open the browser." -ForegroundColor Cyan
