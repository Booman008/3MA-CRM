#!/bin/bash
echo "Starting 3MA-CRM..."
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Open browser (macOS)
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null &

# Start server
node server/index.js
