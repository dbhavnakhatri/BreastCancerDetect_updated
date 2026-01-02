#!/bin/bash
# Render Backend Start Script

echo "🚀 Starting Breast Cancer Detection Backend..."

# Start uvicorn server
uvicorn main:app --host 0.0.0.0 --port $PORT

