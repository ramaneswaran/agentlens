#!/bin/bash
# This script downgrades dependencies to compatible versions

# Remove existing node_modules and lock files
echo "Cleaning existing installation..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock
rm -f pnpm-lock.yaml

# Install compatible versions of core dependencies
echo "Installing compatible dependencies..."
npm install --no-save \
  react@18.2.0 \
  react-dom@18.2.0 \
  @types/react@18.2.0 \
  @types/react-dom@18.2.0 \
  vite@4.4.9 \
  @vitejs/plugin-react@4.0.4 \
  bootstrap@5.3.0 \
  react-bootstrap@2.8.0 \
  react-router-dom@6.14.2 \
  recharts@2.7.2 \
  papaparse@5.4.1 \
  plotly.js@2.26.0 \
  react-plotly.js@2.6.0

# Install ESLint and related plugins
echo "Installing ESLint and plugins..."
npm install --no-save \
  eslint@8.45.0 \
  eslint-plugin-react@7.33.0 \
  eslint-plugin-react-hooks@4.6.0 \
  eslint-plugin-react-refresh@0.4.3

# Final npm install to ensure all dependencies are properly linked
echo "Finalizing installation..."
npm install

# Clear Vite cache
echo "Clearing Vite cache..."
rm -rf node_modules/.vite

echo "Downgrade complete. Try running 'npm run dev' now."