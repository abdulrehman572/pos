# Install.ps1 ??? KiryanaPOS Client Installer (7-Day Trial)
# Run as Administrator
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$appName       = "KiryanaPOS"
$progFilesDir  = "$env:ProgramFiles\$appName"
$programData   = "$env:ProgramData\$appName"
$webRoot       = "$programData\web"
$dataDir       = "$programData\data"
$taskName      = "KiryanaPOS Backend"
$port          = 3000
$trialDays     = 7

Write-Host "Installing $appName..." -ForegroundColor Cyan

# 1. Stop and remove any left???over service/task from previous attempts
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Stop-Service KiryanaPOS -Force -ErrorAction SilentlyContinue
sc.exe delete KiryanaPOS -ErrorAction SilentlyContinue
Get-Process backend -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Create directories
New-Item -ItemType Directory -Force -Path $progFilesDir | Out-Null
New-Item -ItemType Directory -Force -Path $webRoot | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# 3. Copy backend executable
Copy-Item -Path ".\backend.exe" -Destination $progFilesDir -Force

# 4. Copy frontend assets
Copy-Item -Path ".\frontend\*" -Destination $webRoot -Recurse -Force

# 5. Set trial start date in registry (only if not already set)
$regPath = "HKCU:\Software\KiryanaPOS"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
$installDate = Get-ItemProperty -Path $regPath -Name "InstallDate" -ErrorAction SilentlyContinue
if (-not $installDate) {
    $today = Get-Date -Format "yyyy-MM-dd"
    Set-ItemProperty -Path $regPath -Name "InstallDate" -Value $today
    Write-Host "Trial started: $today (${trialDays} days)" -ForegroundColor Yellow
} else {
    Write-Host "Existing trial found: $($installDate.InstallDate)" -ForegroundColor Yellow
}

# 6. Create a launcher script that sets env, checks trial, and runs the backend
$launcherPath = "$progFilesDir\start-backend.ps1"
@"
`$regPath = "HKCU:\Software\KiryanaPOS"
`$installDate = Get-ItemProperty -Path `$regPath -Name "InstallDate" -ErrorAction SilentlyContinue
if (`$installDate) {
    `$start = [datetime]::ParseExact(`$installDate.InstallDate, "yyyy-MM-dd", `$null)
    `$daysUsed = ((Get-Date) - `$start).Days
    `$trialDays = $trialDays
    if (`$daysUsed -ge `$trialDays) {
        # Trial expired ??? log and exit without starting backend
        `$logDir = "$dataDir"
        if (-not (Test-Path `$logDir)) { New-Item -ItemType Directory -Force -Path `$logDir | Out-Null }
        `$logMsg = "Trial expired after `$trialDays days. InstallDate: `$($start.ToString('yyyy-MM-dd')). Contact Khubaib Enterprises for licence."
        Add-Content -Path "`$logDir\trial.log" -Value "`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - `$logMsg"
        # Show popup (optional ??? comment out if running as SYSTEM without desktop interaction)
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show("Your 7-day trial of KiryanaPOS has expired.`nPlease contact Khubaib Enterprises to purchase a licence.", "Trial Expired", 0, 16)
        exit 1
    }
}
`$env:WEB_ROOT = "$webRoot"
`$env:DB_PATH = "$dataDir\kiryana.db"
Set-Location "$progFilesDir"
Start-Process -WindowStyle Hidden -FilePath "$progFilesDir\backend.exe" -Wait
"@ | Out-File -FilePath $launcherPath -Encoding ASCII

# 7. Create a Scheduled Task that runs the launcher at system startup
$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$launcherPath`""
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName `
                       -Action $taskAction `
                       -Trigger $taskTrigger `
                       -Settings $taskSettings `
                       -Principal $taskPrincipal `
                       -Force | Out-Null

# 8. Start the task immediately
Start-ScheduledTask -TaskName $taskName
Write-Host "Backend started via Scheduled Task." -ForegroundColor Green

# 9. Create desktop shortcut
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\KiryanaPOS.url")
$shortcut.TargetPath = "http://localhost:$port"
$shortcut.Save()

# 10. Create uninstaller
$uninstaller = @"
Unregister-ScheduledTask -TaskName "$taskName" -Confirm:`$false -ErrorAction SilentlyContinue
Get-Process backend -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Remove-Item -Recurse -Force "$progFilesDir"
Remove-Item -Recurse -Force "$programData"
Remove-Item "$env:USERPROFILE\Desktop\KiryanaPOS.url" -Force
Write-Host "KiryanaPOS uninstalled completely."
"@
$uninstaller | Out-File -FilePath "$progFilesDir\Uninstall.ps1" -Encoding ASCII

Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "Trial: $trialDays days from first install. Open http://localhost:$port or use the desktop shortcut." -ForegroundColor Yellow
Write-Host "If the trial expires, the backend will not start." -ForegroundColor DarkYellow
