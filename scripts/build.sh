#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  BangumiBar 打包脚本"
echo "=========================================="
echo ""

cd "$PROJECT_DIR"

# 确认在正确目录
if [ ! -f "package.json" ]; then
  echo "[错误] 找不到 package.json，请确保在项目根目录运行此脚本"
  exit 1
fi

# 解析命令行参数
BUILD_TARGET=""
CLEAN_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean-only)
      CLEAN_ONLY=true
      shift
      ;;
    --mac|--win|--linux)
      BUILD_TARGET="${1#--}"
      shift
      ;;
    *)
      echo "[警告] 未知参数: $1"
      shift
      ;;
  esac
done

echo "[1/6] 检查依赖..."
if [ ! -d "node_modules" ]; then
  echo "  node_modules 不存在，正在安装依赖..."
  npm install
else
  echo "  依赖已安装 ✓"
fi

echo ""
echo "[2/6] 清理旧的构建产物..."
npm run clean
echo "  构建产物已清理 ✓"

if [ "$CLEAN_ONLY" = true ]; then
  echo ""
  echo "[完成] 仅清理模式，已删除旧构建产物"
  exit 0
fi

echo ""
echo "[3/6] 构建前端资源 (vite build)..."
npm run build
echo "  前端构建完成 ✓"

echo ""
echo "[4/6] 打包 Electron 应用..."

if [ -n "$BUILD_TARGET" ]; then
  case $BUILD_TARGET in
    mac)
      npm run pack:mac
      ;;
    win)
      npm run pack:win
      ;;
    linux)
      npm run pack:linux
      ;;
  esac
else
  echo "  未指定平台，使用默认配置打包..."
  npm run pack:dir
fi
echo "  打包完成 ✓"

echo ""
echo "[5/6] 查找生成的包..."
if [ -d "release" ]; then
  echo "  打包产物位于 release/ 目录:"
  find release -name "*.app" -o -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" 2>/dev/null | while read f; do
    size=$(du -sh "$f" 2>/dev/null | cut -f1)
    echo "    $size  $f"
  done
else
  echo "  未找到 release 目录"
fi

echo ""
echo "[6/6] 清理中间缓存..."
rm -rf node_modules/.cache 2>/dev/null || true

echo ""
echo "=========================================="
echo "  打包完成！"
echo "=========================================="
echo ""
echo "运行命令说明:"
echo "  ./scripts/build.sh              - 清理并打包 (当前平台)"
echo "  ./scripts/build.sh --mac        - 仅打包 macOS 版本"
echo "  ./scripts/build.sh --win        - 仅打包 Windows 版本"
echo "  ./scripts/build.sh --linux      - 仅打包 Linux 版本"
echo "  ./scripts/build.sh --clean-only - 仅清理旧产物"
echo ""
