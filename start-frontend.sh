#!/bin/bash

# Script chạy Frontend React cho KaitoKid Shop

FRONTEND_DIR="/home/kaito/Videos/kaitokidshop-main/kaito-kid-react"

echo "🚀 Starting KaitoKid Frontend..."

cd $FRONTEND_DIR

# Kiểm tra node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Starting Vite dev server..."
npm run dev
