#!/bin/bash

# Script chạy tất cả Backend APIs cho KaitoKid Shop
# Sử dụng tmux để chạy song song các API trong session riêng

SESSION_NAME="kaitokid-backend"
BACKEND_DIR="/home/kaito/Videos/kaitokidshop-main/BACKEND"

echo "🚀 Starting KaitoKid Backend Services..."

# Kiểm tra tmux đã cài chưa
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux chưa cài. Đang cài tmux..."
    sudo apt-get install -y tmux
fi

# Kill session cũ nếu có
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Tạo session mới với API.Auth
echo "📦 Starting API.Auth (port 5053)..."
tmux new-session -d -s $SESSION_NAME -n "API.Auth" "cd $BACKEND_DIR/API.Auth && dotnet run"

# Thêm window cho API.Admin
echo "📦 Starting API.Admin (port 5089)..."
tmux new-window -t $SESSION_NAME -n "API.Admin" "cd $BACKEND_DIR/API.Admin && dotnet run"

# Thêm window cho API.Customer
echo "📦 Starting API.Customer (port 5265)..."
tmux new-window -t $SESSION_NAME -n "API.Customer" "cd $BACKEND_DIR/API.Customer && dotnet run"

# Thêm window cho API.Gateway
echo "📦 Starting API.Gateway (port 5155)..."
tmux new-window -t $SESSION_NAME -n "API.Gateway" "cd $BACKEND_DIR/API.Gateway && dotnet run"

echo ""
echo "✅ Tất cả Backend APIs đang khởi động trong tmux session: $SESSION_NAME"
echo ""
echo "📋 Danh sách services:"
echo "   • API.Auth     → http://localhost:5053"
echo "   • API.Admin    → http://localhost:5089"
echo "   • API.Customer → http://localhost:5265"
echo "   • API.Gateway  → http://localhost:5155"
echo ""
echo "🔧 Các lệnh hữu ích:"
echo "   • Xem tất cả services: tmux attach -t $SESSION_NAME"
echo "   • Chuyển window: Ctrl+B rồi nhấn số (0,1,2,3)"
echo "   • Thoát (không stop): Ctrl+B rồi D"
echo "   • Dừng tất cả: tmux kill-session -t $SESSION_NAME"
echo ""
