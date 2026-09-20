$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Set-Location backend
if (-not (Test-Path node_modules)) {
  Write-Host 'Installing backend dependencies...' -ForegroundColor Cyan
  npm install
}
Write-Host ''
Write-Host 'VELNOX backend starting...' -ForegroundColor Green
Write-Host 'Health: http://localhost:3000/api/health'
Write-Host 'Admin:  http://localhost:3000/admin/'
Write-Host 'Login: admin / velnox123'
Write-Host ''
npm start
