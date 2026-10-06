@echo off
title SignalScript Engine
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js를 찾지 못했습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)
if not exist "%~dp0bin\whisper-cli.exe" (
  echo 로컬 전사 엔진이 아직 설치되지 않았습니다.
  echo 먼저 Install-Engine.cmd를 실행해 주세요.
  pause
  exit /b 1
)
if not exist "%~dp0models\ggml-small.bin" (
  echo 한국어 Whisper 모델이 아직 설치되지 않았습니다.
  echo 먼저 Install-Engine.cmd를 실행해 주세요.
  pause
  exit /b 1
)
node "%~dp0engine.js"
echo.
echo SignalScript Engine이 종료되었습니다.
pause
