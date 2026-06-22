# AdHub Quick Setup Script (Windows PowerShell)
Write-Host "=== AdHub Setup ===" -ForegroundColor Cyan

# Check Node
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

# Install backend deps
Write-Host "`nInstalling backend dependencies..." -ForegroundColor Yellow
Set-Location backend
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created backend/.env - EDIT THIS FILE before running!" -ForegroundColor Yellow
}
npm install
Set-Location ..

# Install frontend deps
Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
npm install
Set-Location ..

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit backend/.env with your DB credentials and secrets"
Write-Host "  2. Create database: psql -U postgres -c 'CREATE DATABASE adhub;'"
Write-Host "  3. Run migrations: psql -d adhub -f database/migrations/001_initial_schema.sql"
Write-Host "  4. Run seeds: psql -d adhub -f database/seeds/001_seed_data.sql"
Write-Host "  5. Start backend: cd backend && npm run dev"
Write-Host "  6. Start frontend: cd frontend && npm run dev"
Write-Host "  7. Open http://localhost:3000"
