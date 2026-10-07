@echo off
title SignalScript Engine
where node >nul 2>&1
if errorlevel 1 goto no_node
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
