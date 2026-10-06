$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 20 이상이 필요합니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 Install-Engine.cmd를 다시 실행해 주세요.' }
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $root 'bin'
$models = Join-Path $root 'models'
New-Item -ItemType Directory -Force -Path $bin, $models | Out-Null
$zip = Join-Path $env:TEMP 'signalscript-whisper.zip'
Invoke-WebRequest 'https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip' -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $bin -Force
Remove-Item $zip
$cli = Get-ChildItem -Path $bin -Recurse -Filter 'whisper-cli.exe' | Select-Object -First 1
if (-not $cli) { throw 'whisper-cli.exe를 압축 파일에서 찾지 못했습니다.' }
if ($cli.Directory.FullName -ne $bin) { Copy-Item -Path (Join-Path $cli.Directory.FullName '*') -Destination $bin -Recurse -Force }
Invoke-WebRequest 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' -OutFile (Join-Path $models 'ggml-small.bin')
Write-Host '설치가 완료되었습니다. Start-Engine.cmd를 실행한 뒤 SignalScript 웹사이트를 여세요.'
