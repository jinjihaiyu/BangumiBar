#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/release"
ARTIFACT_DIR="$PROJECT_DIR/release-artifacts"

# 从 package.json 读取版本号
VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")

echo "=========================================="
echo "  BangumiBar Release 打包脚本"
echo "=========================================="
echo "版本: v$VERSION"
echo ""

if [ ! -d "$RELEASE_DIR" ]; then
  echo "[错误] 找不到 release/ 目录，请先运行构建脚本："
  echo "       ./scripts/build.sh --mac --win --linux"
  exit 1
fi

# 清理旧的打包文件
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

COLLECTED=0

human_size() {
  du -sh "$1" 2>/dev/null | cut -f1
}

# ------------------------------------------------------------------
# [1/3] 收集 electron-builder 已经生成好的安装包
#       文件名由 package.json 的 artifactName 控制，已符合命名规范，
#       这里原样拷贝，只把历史遗留名字里的空格换成短横线。
#       跳过 *.blockmap 与 latest*.yml —— 那是 electron-updater 的
#       增量更新元数据，本项目未接入自动更新，不需要随 Release 上传。
# ------------------------------------------------------------------
echo "[1/3] 收集安装包 (dmg / exe / AppImage ...)"
INSTALLER_COUNT=0
while IFS= read -r installer; do
  if [ -z "$installer" ]; then continue; fi
  base="$(basename "$installer")"
  safe_base="$(printf '%s' "$base" | tr ' ' '-')"
  cp -p "$installer" "$ARTIFACT_DIR/$safe_base"
  if [ "$safe_base" != "$base" ]; then
    echo "      + $safe_base  ($(human_size "$installer"))  [原名含空格，已重命名]"
  else
    echo "      + $safe_base  ($(human_size "$installer"))"
  fi
  INSTALLER_COUNT=$((INSTALLER_COUNT + 1))
  COLLECTED=$((COLLECTED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 -type f \
  \( -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" \
     -o -name "*.deb" -o -name "*.rpm" -o -name "*.snap" \) | sort)

if [ "$INSTALLER_COUNT" -eq 0 ]; then
  echo "      (未找到安装包 —— 若本次只跑了 --dir 模式，属正常)"
fi

# ------------------------------------------------------------------
# [2/3] 把每个 .app 压成 zip / tar.gz
#       .app 内有 14 个符号链接（含 Electron Framework 主二进制），
#       用 zip -r 会跟随符号链接把内容重复打包：体积从 95MB 涨到 282MB，
#       且 framework 的目录结构被破坏。ditto 是 Apple 推荐做法，
#       保留符号链接与资源分支。
# ------------------------------------------------------------------
echo ""
echo "[2/3] 打包 macOS .app (zip / tar.gz)"
APP_COUNT=0
while IFS= read -r app_path; do
  if [ -z "$app_path" ]; then continue; fi
  APP_COUNT=$((APP_COUNT + 1))

  app_parent="$(dirname "$app_path")"
  app_name="$(basename "$app_path")"
  # 产物标签取平台目录名，如 mac-arm64 / mac / mac-universal
  artifact_tag="$(basename "$app_parent")"

  zip_name="BangumiBar-${VERSION}-${artifact_tag}.zip"
  tar_name="BangumiBar-${VERSION}-${artifact_tag}.tar.gz"

  if command -v ditto >/dev/null 2>&1; then
    (cd "$app_parent" && ditto -c -k --sequesterRsrc --keepParent "$app_name" "$ARTIFACT_DIR/$zip_name")
  else
    # 非 macOS 环境的兜底：-y 保留符号链接，不要去掉
    (cd "$app_parent" && zip -r -y -q "$ARTIFACT_DIR/$zip_name" "$app_name" -x "*.DS_Store")
  fi
  echo "      + $zip_name  ($(human_size "$ARTIFACT_DIR/$zip_name"))"

  # COPYFILE_DISABLE=1 避免 macOS tar 往归档里塞 ._* AppleDouble 文件
  COPYFILE_DISABLE=1 tar -czf "$ARTIFACT_DIR/$tar_name" --exclude='.DS_Store' -C "$app_parent" "$app_name"
  echo "      + $tar_name  ($(human_size "$ARTIFACT_DIR/$tar_name"))"

  COLLECTED=$((COLLECTED + 2))
done < <(find "$RELEASE_DIR" -maxdepth 2 -type d -name "*.app" | sort)

if [ "$APP_COUNT" -eq 0 ]; then
  echo "      (未找到 .app —— 若本次未打 macOS，属正常)"
fi

# ------------------------------------------------------------------
# [3/3] 汇总
# ------------------------------------------------------------------
echo ""
echo "[3/3] 汇总"

if [ "$COLLECTED" -eq 0 ]; then
  echo ""
  echo "[错误] release-artifacts/ 为空，没有任何可发布的产物。"
  echo "       release/ 里既没有安装包也没有 .app，请带平台参数重新构建："
  echo "         ./scripts/build.sh --mac --win --linux"
  exit 1
fi

echo ""
echo "=========================================="
echo "  打包完成！共 $COLLECTED 个产物"
echo "=========================================="
echo ""
echo "请在 GitHub Release 页面上传 release-artifacts/ 下的文件："
while IFS= read -r artifact; do
  if [ -z "$artifact" ]; then continue; fi
  printf "  %-8s %s\n" "$(human_size "$artifact")" "$(basename "$artifact")"
done < <(find "$ARTIFACT_DIR" -maxdepth 1 -type f | sort)
echo ""
echo "文件名规范：BangumiBar-{版本号}-{产物标签}.{格式}"
echo "  例如：BangumiBar-1.2.0-mac-arm64.dmg / BangumiBar-1.2.0-win-x64.exe"
echo ""
echo "提示：安装包的文件名由 package.json 中各平台的 artifactName 控制，"
echo "      如需调整命名规则请改那里，而不是改本脚本。"
echo ""
