# Kiryana POS - One‑click server runner (Windows)
Write-Host "🚀 Starting Kiryana POS server..." -ForegroundColor Cyan

# Check/install Bun
$bunInstalled = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunInstalled) {
    Write-Host "📦 Installing Bun for Windows..." -ForegroundColor Yellow
    powershell -c "irm bun.sh/install.ps1 | iex"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "✅ Bun installed" -ForegroundColor Green
} else {
    Write-Host "✅ Bun already installed" -ForegroundColor Green
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
bun install

# Run migrations
Write-Host "🗄️ Running database migrations..." -ForegroundColor Cyan
bun run backend/src/db/migrate.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migrations failed" -ForegroundColor Red
    exit 1
}

# Seed database (optional)
Write-Host "🌱 Seeding database..." -ForegroundColor Cyan
bun run backend/src/db/seed.ts

# Start server
Write-Host "🚀 Starting server at http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
bun run backend/src/index.ts
