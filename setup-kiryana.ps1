# Kiryana POS - Windows Setup Script
# Run this script as Administrator in the project root folder.

Write-Host "🚀 Starting Kiryana POS setup on Windows 10..." -ForegroundColor Cyan

# --- 1. Check if Bun is installed ---
$bunPath = "bun.exe"
$bunInstalled = Get-Command $bunPath -ErrorAction SilentlyContinue
if (-not $bunInstalled) {
    Write-Host "📦 Bun not found. Installing Bun for Windows..." -ForegroundColor Yellow
    # Download and run Bun installer (PowerShell one-liner)
    powershell -c "irm bun.sh/install.ps1 | iex"
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "✅ Bun installed successfully." -ForegroundColor Green
} else {
    Write-Host "✅ Bun already installed." -ForegroundColor Green
}

# --- 2. Install Node.js (optional but useful for some tools) ---
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "📦 Node.js not found. Downloading Node.js LTS..." -ForegroundColor Yellow
    $nodeInstaller = "$env:TEMP\node-setup.exe"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile $nodeInstaller
    Start-Process msiexec.exe -Wait -ArgumentList "/i $nodeInstaller /quiet"
    Remove-Item $nodeInstaller
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "✅ Node.js installed." -ForegroundColor Green
} else {
    Write-Host "✅ Node.js already installed." -ForegroundColor Green
}

# --- 3. Install project dependencies using Bun ---
Write-Host "📦 Installing npm dependencies with Bun..." -ForegroundColor Cyan
bun install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies. Check your internet connection." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed." -ForegroundColor Green

# --- 4. Run database migrations ---
Write-Host "🗄️ Running database migrations..." -ForegroundColor Cyan
# Assuming you have a migration script like `bun run db:migrate`
bun run backend/src/db/migrate.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migrations failed." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migrations completed." -ForegroundColor Green

# --- 5. Seed the database ---
Write-Host "🌱 Seeding database with initial data..." -ForegroundColor Cyan
bun run backend/src/db/seed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seeding failed." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Seeding completed." -ForegroundColor Green

# --- 6. Build Tailwind CSS (if using Tailwind) ---
Write-Host "🎨 Building Tailwind CSS..." -ForegroundColor Cyan
# Assuming you have a script in package.json: "build:css": "tailwindcss -i ./frontend/css/input.css -o ./frontend/css/output.css"
if (Test-Path "node_modules/.bin/tailwindcss") {
    bunx tailwindcss -i ./frontend/css/input.css -o ./frontend/css/output.css
    Write-Host "✅ Tailwind CSS built." -ForegroundColor Green
} else {
    Write-Host "⚠️ Tailwind not found, skipping CSS build." -ForegroundColor Yellow
}

# --- 7. Start the dev server ---
Write-Host "🚀 Starting development server..." -ForegroundColor Cyan
Write-Host "Server will be available at http://localhost:3000" -ForegroundColor Cyan
bun run backend/src/index.ts