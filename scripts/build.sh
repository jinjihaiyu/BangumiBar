#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

usage() {
  cat <<'EOF'
用法: ./scripts/build.sh [平台...] [架构...] [选项]

平台 (可叠加；不指定时只生成解包目录，不产出安装包):
  --mac              macOS   -> dmg
  --win              Windows -> nsis 安装包
  --linux            Linux   -> AppImage

架构 (可叠加；不指定时使用当前机器架构):
  --arm64            arm64 (Apple Silicon)
  --x64              x64   (Intel Mac / 常规 Windows、Linux)
  --universal        macOS 通用二进制 (arm64 + x64 合成一个包)

选项:
  --dir              只生成解包目录，跳过所有安装包 (最快，用于本地验证)
  --clean-only       仅清理旧产物后退出
  -h, --help         显示本帮助

示例:
  ./scripts/build.sh --mac                    只打 macOS dmg (当前架构)
  ./scripts/build.sh --mac --win --linux      一次打全三个平台
  ./scripts/build.sh --mac --arm64 --x64      arm64 与 Intel 两个 mac dmg 都打

说明:
  * dmg 只能在 macOS 上生成；反过来，在 macOS 上打 win / linux 不需要
    wine 或 Docker，electron-builder 自带的原生工具链即可。
  * 架构参数对所有指定平台同时生效。例如 "--mac --win --arm64 --x64"
    会连 Windows arm64 一起打，按需组合以免浪费时间。
  * 本脚本第一步会执行 npm run clean，即 rm -rf dist release release-artifacts。
    上一轮的产物会被全部删除，需要保留请先备份。
EOF
}

echo "=========================================="
echo "  BangumiBar 打包脚本"
echo "=========================================="
echo ""

# 确认在正确目录
if [ ! -f "package.json" ]; then
  echo "[错误] 找不到 package.json，请确保在项目根目录运行此脚本"
  exit 1
fi

# 解析命令行参数
BUILD_TARGETS=()
ARCH_FLAGS=()
CLEAN_ONLY=false
DIR_ONLY=false

# 平台、架构参数可以叠加，重复传入只保留一次
add_target() {
  local candidate="$1"
  local item
  for item in "${BUILD_TARGETS[@]}"; do
    if [ "$item" = "$candidate" ]; then
      return 0
    fi
  done
  BUILD_TARGETS+=("$candidate")
}

add_arch() {
  local candidate="$1"
  local item
  for item in "${ARCH_FLAGS[@]}"; do
    if [ "$item" = "$candidate" ]; then
      return 0
    fi
  done
  ARCH_FLAGS+=("$candidate")
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean-only)
      CLEAN_ONLY=true
      shift
      ;;
    --dir)
      DIR_ONLY=true
      shift
      ;;
    --mac|--win|--linux)
      add_target "$1"
      shift
      ;;
    --arm64|--x64|--universal)
      add_arch "$1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[警告] 未知参数: $1 (用 --help 查看用法)"
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

BUILDER="./node_modules/.bin/electron-builder"
if [ ! -x "$BUILDER" ]; then
  echo "[错误] 找不到 electron-builder ($BUILDER)，请运行 npm install"
  exit 1
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

if [ ${#BUILD_TARGETS[@]} -eq 0 ]; then
  echo "  [注意] 未指定平台，只为当前平台生成解包目录。"
  DIR_ONLY=true
fi

BUILDER_ARGS=()
if [ ${#BUILD_TARGETS[@]} -gt 0 ]; then
  BUILDER_ARGS+=("${BUILD_TARGETS[@]}")
fi
if [ ${#ARCH_FLAGS[@]} -gt 0 ]; then
  BUILDER_ARGS+=("${ARCH_FLAGS[@]}")
fi
if [ "$DIR_ONLY" = true ]; then
  BUILDER_ARGS+=("--dir")
  echo "  [注意] --dir 模式不会产出 dmg / exe / AppImage，只有解包目录。"
  echo "         需要安装包请指定平台，例如："
  echo "           ./scripts/build.sh --mac --win --linux"
fi

echo "  执行: electron-builder ${BUILDER_ARGS[*]}"
"$BUILDER" "${BUILDER_ARGS[@]}"
echo "  打包完成 ✓"

echo ""
echo "[5/6] 查找生成的包..."

print_artifact() {
  local target="$1"
  local size
  size="$(du -sh "$target" 2>/dev/null | cut -f1)"
  printf "    %-8s %s\n" "${size:-?}" "$target"
}

if [ -d "release" ]; then
  echo "  安装包:"
  INSTALLER_COUNT=0
  while IFS= read -r found; do
    if [ -z "$found" ]; then continue; fi
    print_artifact "$found"
    INSTALLER_COUNT=$((INSTALLER_COUNT + 1))
  done < <(find release -maxdepth 1 -type f \
    \( -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" \
       -o -name "*.deb" -o -name "*.rpm" -o -name "*.snap" -o -name "*.zip" \) | sort)
  if [ "$INSTALLER_COUNT" -eq 0 ]; then
    echo "    (无)"
  fi

  echo "  解包产物:"
  UNPACKED_COUNT=0
  while IFS= read -r found; do
    if [ -z "$found" ]; then continue; fi
    print_artifact "$found"
    UNPACKED_COUNT=$((UNPACKED_COUNT + 1))
  done < <({ find release -maxdepth 2 -type d -name "*.app"
             find release -maxdepth 1 -type d -name "*-unpacked"; } | sort)
  if [ "$UNPACKED_COUNT" -eq 0 ]; then
    echo "    (无)"
  fi
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
echo "下一步：整理分发产物"
echo "  ./scripts/release.sh"
echo ""
echo "常用命令："
echo "  ./scripts/build.sh --mac --win --linux   - 一次打全三个平台"
echo "  ./scripts/build.sh --mac --arm64 --x64   - arm64 + Intel 两个 mac 包"
echo "  ./scripts/build.sh --mac                 - 仅 macOS (当前架构)"
echo "  ./scripts/build.sh --dir                 - 仅解包目录，不打安装包"
echo "  ./scripts/build.sh --clean-only          - 仅清理旧产物"
echo "  ./scripts/build.sh --help                - 完整用法"
echo ""
