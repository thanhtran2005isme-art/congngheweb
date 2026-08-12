#!/bin/bash

# Script dừng tất cả services của KaitoKid Shop

SESSION_NAME="kaitokid-backend"

echo "🛑 Stopping all KaitoKid services..."

# Dừng tmux session backend
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    tmux kill-session -t $SESSION_NAME
    echo "✅ Backend APIs stopped"
else
    echo "ℹ️  Backend session not found"
fi

# Dừng Vite dev server (port 5173)
VITE_PID=$(lsof -ti:5173)
if [ ! -z "$VITE_PID" ]; then
    kill $VITE_PID 2>/dev/null
    echo "✅ Frontend (Vite) stopped"
else
    echo "ℹ️  Frontend not running"
fi

echo ""
echo "✅ All services stopped!"
