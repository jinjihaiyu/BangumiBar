#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/release"
ARTIFACT_DIR="$PROJECT_DIR/release-artifacts"

# 从 package.json 读取版本号
VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")
APP_PATH=$(find "$RELEASE_DIR" -maxdepth 2 -type d -name "BangumiBar.app" | head -n 1)

echo "=========================================="
echo "  BangumiBar Release 打包脚本"
echo "=========================================="
echo "版本: v$VERSION"
echo ""

# 检查 .app 是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "[错误] 找不到 BangumiBar.app，请先运行构建脚本"
    exit 1
fi

APP_PARENT_DIR="$(dirname "$APP_PATH")"
PLATFORM_DIR_NAME="$(basename "$APP_PARENT_DIR")"
ARTIFACT_TAG="${PLATFORM_DIR_NAME:-mac}"

echo "检测到应用目录: $APP_PATH"
echo "产物标签: $ARTIFACT_TAG"
echo ""

# 清理旧的打包文件
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

# 打包成 zip
ZIP_NAME="BangumiBar-${VERSION}-${ARTIFACT_TAG}.zip"
ZIP_PATH="$ARTIFACT_DIR/$ZIP_NAME"
echo "[1/2] 打包 BangumiBar.app -> $ZIP_NAME"
if [ -f "$ZIP_PATH" ]; then
    rm "$ZIP_PATH"
fi
cd "$APP_PARENT_DIR"
zip -r "$ZIP_PATH" "BangumiBar.app" -x "*.DS_Store"
echo "       完成: $ZIP_PATH"

# 打包成 tar.gz（可选，体积更小）
TAR_NAME="BangumiBar-${VERSION}-${ARTIFACT_TAG}.tar.gz"
TAR_PATH="$ARTIFACT_DIR/$TAR_NAME"
echo "[2/2] 打包 BangumiBar.app -> $TAR_NAME"
if [ -f "$TAR_PATH" ]; then
    rm "$TAR_PATH"
fi
tar -czf "$TAR_PATH" --exclude='.DS_Store' -C "$APP_PARENT_DIR" "BangumiBar.app"
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
echo "文件名规范：BangumiBar-{版本号}-{产物标签}.{格式}"
echo "  例如：BangumiBar-1.0.0-mac-arm64.zip"
