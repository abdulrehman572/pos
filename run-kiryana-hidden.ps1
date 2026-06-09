# Hidden launcher for Kiryana POS
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$expireScript = Join-Path $repoRoot 'expire-app.ps1'
$startScript = Join-Path $repoRoot 'start-kiryana.ps1'

if (Test-Path $expireScript) {
    try {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $expireScript -InstallPath $repoRoot
    } catch {
        # If expiry check fails, continue to launch if possible
    }
}

if (-not (Test-Path $startScript)) {
    exit 1
}

# Start the backend hidden
$backendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$startScript) -WindowStyle Hidden -PassThru

# Wait for server to become available
$uri = 'http://localhost:3000/'
$timeoutSeconds = 60
$endTime = (Get-Date).AddSeconds($timeoutSeconds)
while ((Get-Date) -lt $endTime) {
    try {
        $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -ge 200) {
            Start-Process $uri
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

Start-Process $uri
exit 0
