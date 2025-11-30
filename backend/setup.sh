#!/bin/bash
# Setup script for Railway deployment
set -e

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install --no-cache-dir -r requirements.txt

echo "Setup complete!"

