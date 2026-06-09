<#
install-client.ps1
Usage: Run this on the client machine (as Administrator) to install the app.
Example: powershell -NoProfile -ExecutionPolicy Bypass -File .\install-client.ps1
#>
param(
    [string]$SourcePath = $(Split-Path -Parent $MyInvocation.MyCommand.Path),
    [string]$InstallPath = "C:\KiryanaPOS",
    [switch]$CreateDesktopShortcut = $true,
    [int]$Port = 3000,
    [string]$BackupTime = "03:00",
    [string]$ExpiryTime = "03:10"
)

function Write-Info($text) { Write-Host $text -ForegroundColor Cyan }
function Write-Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Write-Error($text) { Write-Host $text -ForegroundColor Red }

Write-Info "Installing Kiryana POS from '$SourcePath' to '$InstallPath'"

if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

Write-Info "Copying files..."
try {
    Copy-Item -Path (Join-Path $SourcePath '*') -Destination $InstallPath -Recurse -Force -ErrorAction Stop
    Write-Info "Files copied."
} catch {
    Write-Error "Failed to copy files: $_"
    exit 1
}

$installDateFile = Join-Path $InstallPath 'install-date.txt'
if (-not (Test-Path $installDateFile)) {
    (Get-Date).ToString('o') | Set-Content -Path $installDateFile -NoNewline
    Write-Info "Created install date marker."
}

$backupRoot = Join-Path $InstallPath 'backups'
if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Write-Info "Created backups folder at $backupRoot."
}

function Create-Shortcut($linkPath, $targetPath) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($linkPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $InstallPath
    $iconCandidate = Join-Path $InstallPath 'logo\\favicon.ico'
    if (Test-Path $iconCandidate) { $shortcut.IconLocation = $iconCandidate }
    $shortcut.Save()
}

function Ensure-ScheduledTask($taskName, $scriptPath, $time) {
    if (-not (Test-Path $scriptPath)) {
        Write-Warn "Task script not found: $scriptPath"
        return
    }

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $time
    try {
        if ($isAdmin) {
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Force -ErrorAction Stop
        } else {
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force -ErrorAction Stop
        }
        Write-Info "Registered scheduled task '$taskName'."
    } catch {
        Write-Warn "Register-ScheduledTask failed for '$taskName': $_"
        try {
            $taskAction = "`"powershell.exe`" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
            $args = @('/Create','/F','/SC','DAILY','/TN',$taskName,'/TR',$taskAction,'/ST',$time)
            if ($isAdmin) { $args += '/RL'; $args += 'HIGHEST' } else { $args += '/RL'; $args += 'LIMITED' }
            Start-Process -FilePath 'schtasks.exe' -ArgumentList $args -NoNewWindow -Wait -ErrorAction Stop
            Write-Info "Registered scheduled task '$taskName' via schtasks."
        } catch {
            Write-Warn "Failed to register scheduled task '$taskName' with schtasks: $_"
        }
    }
}

$isAdmin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$hiddenLauncher = Join-Path $InstallPath 'Start-Kiryana.vbs'
$hiddenScript = Join-Path $InstallPath 'run-kiryana-hidden.ps1'
$backupScript = Join-Path $InstallPath 'daily-backup.ps1'
$expiryScript = Join-Path $InstallPath 'expire-app.ps1'

if ($CreateDesktopShortcut) {
    $vbsContent = @"
Set shell = CreateObject("WScript.Shell")
root = Replace(WScript.ScriptFullName, "Start-Kiryana.vbs", "")
script = root & "run-kiryana-hidden.ps1"
command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & script & """"
shell.Run command, 0, false
"@

    $vbsContent | Set-Content -Path $hiddenLauncher -NoNewline
    Write-Info "Created hidden launcher: $hiddenLauncher"

    $userDesktop = [Environment]::GetFolderPath('Desktop')
    $commonDesktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
    if ($isAdmin) {
        try {
            $publicShortcut = Join-Path $commonDesktop 'Kiryana POS.lnk'
            Create-Shortcut $publicShortcut $hiddenLauncher
            Write-Info "Created public Desktop shortcut: $publicShortcut"
        } catch {
            Write-Warn "Failed to create public Desktop shortcut: $_"
        }
    }
    try {
        $userShortcut = Join-Path $userDesktop 'Kiryana POS.lnk'
        Create-Shortcut $userShortcut $hiddenLauncher
        Write-Info "Created user Desktop shortcut: $userShortcut"
    } catch {
        Write-Warn "Failed to create user Desktop shortcut: $_"
    }

    Ensure-ScheduledTask 'KiryanaPOS Daily Backup' $backupScript $BackupTime
    Ensure-ScheduledTask 'KiryanaPOS Expiry Cleanup' $expiryScript $ExpiryTime
}

if ($isAdmin) {
    try {
        $existing = Get-NetFirewallRule -DisplayName "KiryanaPOS HTTP" -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-NetFirewallRule -DisplayName "KiryanaPOS HTTP" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile Any -ErrorAction Stop
            Write-Info "Firewall rule added for port $Port."
        } else {
            Write-Warn "Firewall rule already exists."
        }
    } catch {
        Write-Warn "Failed to add firewall rule: $_"
    }
} else {
    Write-Warn "Not running as Administrator: firewall rule was not added."
}

Write-Info "Installation complete. Double-click the Desktop shortcut to start Kiryana POS."
Write-Info "The app will make a daily backup and auto-expire after 7 days, preserving only the backups folder."
