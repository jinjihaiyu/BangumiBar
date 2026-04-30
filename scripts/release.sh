#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/release"
DIST_DIR="$PROJECT_DIR/dist"

# 从 package.json 读取版本号
VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    ARCH_STR="mac-arm64"
else
    ARCH_STR="mac-x64"
fi

echo "=========================================="
echo "  BangumiBar Release 打包脚本"
echo "=========================================="
echo "版本: v$VERSION"
echo "平台: $ARCH_STR"
echo ""

# 检查 .app 是否存在
APP_PATH="$RELEASE_DIR/mac-arm64/BangumiBar.app"
if [ ! -d "$APP_PATH" ]; then
    echo "[错误] 找不到 BangumiBar.app，请先运行构建脚本"
    exit 1
fi

# 清理旧的打包文件
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 打包成 zip
ZIP_NAME="BangumiBar-${VERSION}-${ARCH_STR}-mac.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"
echo "[1/2] 打包 BangumiBar.app -> $ZIP_NAME"
if [ -f "$ZIP_PATH" ]; then
    rm "$ZIP_PATH"
fi
cd "$RELEASE_DIR/mac-arm64"
zip -r "$ZIP_PATH" "BangumiBar.app" -x "*.DS_Store"
echo "       完成: $ZIP_PATH"

# 打包成 tar.gz（可选，体积更小）
TAR_NAME="BangumiBar-${VERSION}-${ARCH_STR}-mac.tar.gz"
TAR_PATH="$DIST_DIR/$TAR_NAME"
echo "[2/2] 打包 BangumiBar.app -> $TAR_NAME"
if [ -f "$TAR_PATH" ]; then
    rm "$TAR_PATH"
fi
tar -czf "$TAR_PATH" --exclude='.DS_Store' -C "$RELEASE_DIR/mac-arm64" "BangumiBar.app"
echo "       完成: $TAR_PATH"

echo ""
echo "=========================================="
echo "  打包完成！"
echo "=========================================="
echo ""
echo "请在 GitHub Release 页面上传以下文件："
echo "  - $ZIP_PATH"
echo "  - $TAR_PATH"
echo ""
echo "文件名规范：BangumiBar-{版本号}-{平台}.{格式}"
echo "  例如：BangumiBar-1.0.0-mac-arm64-mac.zip"
