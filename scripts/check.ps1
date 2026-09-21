$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdk = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
if (!(Test-Path $sdk)) { $sdk = 'dotnet' }
Push-Location (Join-Path $projectRoot 'frontend/putmeon-web')
try {
  npm run check
  if ($LASTEXITCODE -ne 0) { throw 'Frontend checks failed.' }
  npm run test:browser
  if ($LASTEXITCODE -ne 0) { throw 'Browser regression checks failed.' }
} finally { Pop-Location }
& $sdk build (Join-Path $projectRoot 'backend/PutMeOn.Api/PutMeOn.Api.csproj')
if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
& $sdk run --project (Join-Path $projectRoot 'backend/PutMeOn.Checks/PutMeOn.Checks.csproj')
if ($LASTEXITCODE -ne 0) { throw 'Database checks failed.' }
