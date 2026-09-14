$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdk = Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
if (!(Test-Path $sdk)) { $sdk = (Get-Command dotnet).Source }
$runtimeDir = Join-Path $projectRoot '.local-app'
$apiDir = Join-Path $projectRoot 'backend/PutMeOn.Api'
$dbFile = Join-Path $apiDir 'putmeon.db'
$listener = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue
if ($listener) { throw 'Port 5173 is already in use. Stop the existing preview before starting the local app.' }
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Push-Location (Join-Path $projectRoot 'frontend/putmeon-web')
try {
  $env:VITE_DATA_MODE = 'api'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
& $sdk publish (Join-Path $apiDir 'PutMeOn.Api.csproj') -c Release -o $runtimeDir
if ($LASTEXITCODE -ne 0) { throw 'API publish failed.' }
$webRoot = Join-Path $runtimeDir 'wwwroot'
New-Item -ItemType Directory -Path $webRoot -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'frontend/putmeon-web/dist/*') -Destination $webRoot -Recurse -Force
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Database__Provider = 'Sqlite'
$env:ConnectionStrings__Database = "Data Source=$dbFile"
$app = Start-Process -FilePath $sdk -ArgumentList @('PutMeOn.Api.dll','--urls','http://127.0.0.1:5173') -WorkingDirectory $runtimeDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'stderr.log')
$app.Id | Set-Content (Join-Path $runtimeDir 'process.id')
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  if ($app.HasExited) { throw 'Local app failed to start. See .local-app/stderr.log.' }
  try {
    $response = Invoke-WebRequest 'http://127.0.0.1:5173/api/health' -TimeoutSec 2
    if ($response.StatusCode -eq 200) { Write-Host 'PutMeOn is ready: http://127.0.0.1:5173 (runs in background).'; exit 0 }
  } catch { Start-Sleep -Milliseconds 300 }
}
throw 'Local app did not become healthy. See .local-app logs.'
