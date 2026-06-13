param(
    [string]$InstallPath = "C:\\KiryanaPOS"
)

function Write-Info($t) { Write-Host $t -ForegroundColor Cyan }
function Write-Warn($t) { Write-Host $t -ForegroundColor Yellow }

if (-not (Test-Path $InstallPath)) { Write-Warn "Install path not found: $InstallPath"; exit 0 }

# Prefer a dedicated start script if present
$startPs = Join-Path $InstallPath 'start-kiryana.ps1'
if (Test-Path $startPs) {
    Write-Info "Launching start-kiryana.ps1"
    Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$startPs`"" -WindowStyle Hidden -NoNewWindow
    exit 0
}

# Fallback: try an npm/bun start if package.json exists
if (Test-Path (Join-Path $InstallPath 'package.json')) {
    Write-Info "package.json found — attempting to run 'npm start' in background"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','cd',"`"$InstallPath`"",'&&','npm','run','start' -WorkingDirectory $InstallPath -WindowStyle Hidden -NoNewWindow
    exit 0
}

Write-Warn "No start script found. Add a 'start-kiryana.ps1' or package.json 'start' script in $InstallPath to auto-launch the app."
