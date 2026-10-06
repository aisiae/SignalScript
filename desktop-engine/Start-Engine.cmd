@echo off
title SignalScript Engine
where node >nul 2>&1
if errorlevel 1 goto no_node
if not exist "%~dp0bin\whisper-server.exe" goto no_engine
if not exist "%~dp0models\ggml-base.bin" goto no_model
node "%~dp0engine.js"
echo.
echo SignalScript Engine stopped.
pause
exit /b

:no_node
echo Node.js is required before starting SignalScript Engine.
echo Install the LTS version from https://nodejs.org, then run this file again.
pause
exit /b 1

:no_engine
echo The local engine is not installed yet.
echo Run Install-Engine.cmd first, then run this file again.
pause
exit /b 1

:no_model
echo The Korean Whisper model is not installed yet.
echo Run Install-Engine.cmd first, then run this file again.
pause
exit /b 1
