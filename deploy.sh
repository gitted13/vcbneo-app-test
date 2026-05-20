#!/usr/bin/env bash
# Script deploy trên server Ubuntu
# Chạy: bash deploy.sh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo ">>> Pull code mới nhất..."
git pull origin main

echo ">>> Build và khởi động containers..."
docker compose build --pull
docker compose up -d --remove-orphans

echo ">>> Trạng thái services:"
docker compose ps

echo ""
echo "=== Deploy hoàn tất ==="
echo "App đang chạy tại http://$(hostname -I | awk '{print $1}')"
