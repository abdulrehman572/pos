param(
    [string]$InstallPath = "C:\\KiryanaPOS",
    [string]$BackupTime = "03:00",
    [string]$ExpiryTime = "03:10",
    [string]$Contact = "03106770401"
)

function Write-Info($t) { Write-Host $t -ForegroundColor Cyan }
function Write-Warn($t) { Write-Host $t -ForegroundColor Yellow }
function Write-Error($t) { Write-Host $t -ForegroundColor Red }

$SourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Info "Source path: $SourcePath"
Write-Info "Install path: $InstallPath"

if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Info "Created install folder: $InstallPath"
}

# Ensure helper scripts are in the install folder
$helpers = @('daily-backup.ps1','run-kiryana-hidden.ps1','expire-app.ps1')
foreach ($h in $helpers) {
    $src = Join-Path $SourcePath $h
    $dst = Join-Path $InstallPath $h
    if (Test-Path $src) {
        try {
            Copy-Item -Path $src -Destination $dst -Force -ErrorAction Stop
            Write-Info "Copied $h to $InstallPath"
        } catch {
            Write-Warn "Failed to copy $h: $_"
        }
    } else {
        Write-Warn "Helper script not found in source: $src"
    }
}

# Create install-date marker if missing
$installDateFile = Join-Path $InstallPath 'install-date.txt'
if (-not (Test-Path $installDateFile)) {
    (Get-Date).ToString('o') | Set-Content -Path $installDateFile -NoNewline -Encoding UTF8
    Write-Info "Created install-date marker."
} else {
    Write-Info "Install-date marker already exists."
}

function Register-Task($taskName, $scriptPath, $time) {
    if (-not (Test-Path $scriptPath)) {
        Write-Warn "Task script missing: $scriptPath"
        return
    }

    $action = "`"powershell.exe`" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
    $args = @('/Create','/F','/SC','DAILY','/TN',$taskName,'/TR',$action,'/ST',$time)
    try {
        Start-Process -FilePath 'schtasks.exe' -ArgumentList $args -NoNewWindow -Wait -ErrorAction Stop
        Write-Info "Registered scheduled task '$taskName' via schtasks."
    } catch {
        Write-Warn "Failed to register scheduled task '$taskName' with schtasks: $_"
    }
}

$backupScript = Join-Path $InstallPath 'daily-backup.ps1'
$expiryScript = Join-Path $InstallPath 'expire-app.ps1'

Register-Task 'KiryanaPOS Daily Backup' $backupScript $BackupTime
Register-Task 'KiryanaPOS Expiry Cleanup' $expiryScript $ExpiryTime

# Run the helper scripts once now (initial run)
try {
    if (Test-Path $backupScript) {
        Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`"" -WindowStyle Hidden -NoNewWindow
        Write-Info "Started initial backup run."
    }
    if (Test-Path $expiryScript) {
        Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$expiryScript`"" -WindowStyle Hidden -NoNewWindow
        Write-Info "Started initial expiry check run."
    }
} catch {
    Write-Warn "Failed to start initial helper scripts: $_"
}

Write-Info "One-time starter (hiden.ps1) complete. Scheduled tasks created and helper scripts invoked." 
