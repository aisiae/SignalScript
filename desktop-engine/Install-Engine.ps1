$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required. Install the LTS release from https://nodejs.org, then run Install-Engine.cmd again.' }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $root 'bin'
$models = Join-Path $root 'models'
New-Item -ItemType Directory -Force -Path $bin, $models | Out-Null

Write-Host 'Downloading the local Whisper engine...'
$zip = Join-Path $env:TEMP 'signalscript-whisper.zip'
Invoke-WebRequest 'https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip' -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $bin -Force
Remove-Item $zip

$cli = Get-ChildItem -Path $bin -Recurse -Filter 'whisper-cli.exe' | Select-Object -First 1
if (-not $cli) { throw 'whisper-cli.exe was not found in the downloaded archive.' }
if ($cli.Directory.FullName -ne $bin) { Copy-Item -Path (Join-Path $cli.Directory.FullName '*') -Destination $bin -Recurse -Force }

Write-Host 'Downloading the Korean Whisper model (about 466 MB)...'
Invoke-WebRequest 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' -OutFile (Join-Path $models 'ggml-small.bin')
Write-Host 'SignalScript Engine installation completed.'
