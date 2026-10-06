$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required. Install the LTS release from https://nodejs.org, then run Install-Engine.cmd again.' }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $root 'bin'
$models = Join-Path $root 'models'
New-Item -ItemType Directory -Force -Path $bin, $models | Out-Null

Write-Host 'Downloading the local Whisper engine...'
$zip = Join-Path $env:TEMP 'signalscript-whisper.zip'
$headers = @{ 'User-Agent' = 'SignalScript-Engine' }
$releases = Invoke-RestMethod 'https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=20' -Headers $headers
$asset = $null
foreach ($release in $releases) {
  $asset = $release.assets | Where-Object { $_.name -eq 'whisper-bin-x64.zip' } | Select-Object -First 1
  if ($asset) { break }
}
if (-not $asset) { throw 'No Windows x64 engine archive was found in the recent Whisper releases.' }
Invoke-WebRequest $asset.browser_download_url -Headers $headers -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $bin -Force
Remove-Item $zip

$server = Get-ChildItem -Path $bin -Recurse -Filter 'whisper-server.exe' | Select-Object -First 1
if (-not $server) { throw 'whisper-server.exe was not found in the downloaded archive.' }
if ($server.Directory.FullName -ne $bin) { Copy-Item -Path (Join-Path $server.Directory.FullName '*') -Destination $bin -Recurse -Force }

Write-Host 'Downloading the Korean Whisper Base model (about 142 MB)...'
Invoke-WebRequest 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' -OutFile (Join-Path $models 'ggml-base.bin')
Write-Host 'SignalScript Engine installation completed.'
