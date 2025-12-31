#!/bin/bash
# Render.com Startup Script
# This script runs when your app starts on Render

echo "🚀 Starting Breast Cancer Detection Backend..."

# Check if model exists (should be present via Git LFS)
echo "📥 Checking for model file..."
if [ -f "models/breast_cancer_model.keras" ]; then
    MODEL_SIZE=$(du -h "models/breast_cancer_model.keras" | cut -f1)
    echo "✅ Model file found! (Size: $MODEL_SIZE)"
else
    echo "❌ ERROR: Model file not found at models/breast_cancer_model.keras"
    echo "   Make sure Git LFS is enabled on your Git provider (GitHub/GitLab)"
    exit 1
fi

# Start the FastAPI server
echo "🌐 Starting FastAPI server on port ${PORT:-8000}..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

