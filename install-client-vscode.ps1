<#
install-client-vscode.ps1
Run this from the extracted app folder in VS Code to install to C:\KiryanaPOS and create a hidden desktop shortcut.
#>
param(
    [string]$InstallPath = "C:\KiryanaPOS",
    [int]$Port = 3000,
    [string]$BackupTime = "03:00",
    [string]$ExpiryTime = "03:10"
)

function Write-Info($text) { Write-Host $text -ForegroundColor Cyan }
function Write-Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Write-Error($text) { Write-Host $text -ForegroundColor Red }

$SourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Info "Source path: $SourcePath"
Write-Info "Install path: $InstallPath"

if ($SourcePath -ne $InstallPath) {
    Write-Info "Copying app files to $InstallPath..."
    try {
        if (-not (Test-Path $InstallPath)) {
            New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        }
        Copy-Item -Path (Join-Path $SourcePath '*') -Destination $InstallPath -Recurse -Force -ErrorAction Stop
        Write-Info "Files copied to $InstallPath."
    } catch {
        Write-Error "Failed to copy files: $_"
        exit 1
    }
} else {
    Write-Info "Source is already the install folder; no copy needed."
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

function Create-ShortcutInternal($linkPath) {
    Create-Shortcut $linkPath $hiddenLauncher
}

if ($isAdmin) {
    try {
        $publicShortcut = Join-Path $commonDesktop 'Kiryana POS.lnk'
        Create-ShortcutInternal $publicShortcut
        Write-Info "Created public Desktop shortcut: $publicShortcut"
    } catch {
        Write-Warn "Failed to create public Desktop shortcut: $_"
    }
}
try {
    $userShortcut = Join-Path $userDesktop 'Kiryana POS.lnk'
    Create-ShortcutInternal $userShortcut
    Write-Info "Created user Desktop shortcut: $userShortcut"
} catch {
    Write-Error "Failed to create user Desktop shortcut: $_"
    exit 1
}

Ensure-ScheduledTask 'KiryanaPOS Daily Backup' $backupScript $BackupTime
Ensure-ScheduledTask 'KiryanaPOS Expiry Cleanup' $expiryScript $ExpiryTime

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
