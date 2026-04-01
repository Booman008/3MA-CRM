@echo off
echo Starting 3MA-CRM...
cd /d "%~dp0"

:: Install dependencies if needed
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

:: Start server and open browser
start http://localhost:3000
node server/index.js
