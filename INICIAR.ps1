$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path 'server/.env')) { Copy-Item 'server/.env.example' 'server/.env'; $secret = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"; (Get-Content 'server/.env') -replace '^SESSION_SECRET=.*$', "SESSION_SECRET=$secret" | Set-Content 'server/.env' }
if (!(Test-Path 'client/.env')) { Copy-Item 'client/.env.example' 'client/.env' }
npm.cmd install
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
Write-Host 'Asegúrate de tener MongoDB iniciado o MONGODB_URI configurado en server/.env.'
npm.cmd run seed
if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar a MongoDB. Revisa server/.env y vuelve a ejecutar.' }
Write-Host 'Abre http://localhost:5173. Para el mapa configura client/.env.'
npm.cmd run dev
