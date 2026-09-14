param([switch]$Demo)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdk = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
if (!(Test-Path $sdk)) { $sdk = 'dotnet' }
if ($Demo) { $env:VITE_DATA_MODE = 'demo' } else { $env:VITE_DATA_MODE = 'api' }
$api = $null
try {
  if (!$Demo) {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    & $sdk build (Join-Path $projectRoot 'backend/PutMeOn.Api/PutMeOn.Api.csproj')
    if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
    $api = Start-Process -FilePath $sdk -ArgumentList @('bin/Debug/net10.0/PutMeOn.Api.dll','--urls','http://127.0.0.1:5080') -WorkingDirectory (Join-Path $projectRoot 'backend/PutMeOn.Api') -PassThru -WindowStyle Hidden
  }
  Push-Location (Join-Path $projectRoot 'frontend/putmeon-web')
  npm run dev -- --host 127.0.0.1
} finally {
  Pop-Location
  if ($api -and !$api.HasExited) { Stop-Process -Id $api.Id }
}
