#!/bin/bash
# Render Backend Build Script

echo "🚀 Starting Render backend build..."

# Install Python dependencies
echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Build completed successfully!"

