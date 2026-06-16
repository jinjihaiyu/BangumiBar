# 发布收尾清单

这份清单用于当前阶段的发布收尾，默认目标是：

- 可以稳定构建和打包
- 可以给少量试用用户分发未签名版本
- 保留后续签名、公证、安全收口的扩展空间

## 当前发布策略

- 当前采用未签名分发
- 当前已接入发布图标资源：
  - `build/icon.icns`
  - `build/icon.ico`
  - `build/icon.png`
- 当前打包入口已统一到 `package.json` 和 `scripts/build.sh`
- 当前可接受的已知提示：
  - macOS 未签名导致的系统拦截
  - `electron-builder` 的 macOS code signing 缺失提示

## 发布前准备

- 安装依赖：`npm install`
- 清理旧产物：`npm run clean`
- 确认前端可构建：`npm run build`
- 确认 Electron 可打包：`npm run pack:dir`
- 如需按平台打包：
  - `npm run pack:mac`
  - `npm run pack:win`
  - `npm run pack:linux`

## 推荐打包路径

### 方式一：脚本入口

```bash
./scripts/build.sh
```

如果只打某个平台：

```bash
./scripts/build.sh --mac
./scripts/build.sh --win
./scripts/build.sh --linux
```

### 方式二：标准命令入口

```bash
npm run clean
npm run build
npm run pack:dir
```

## 产物位置

- 未压缩应用目录：`release/`
- 额外压缩后的发布包：`release-artifacts/`
- 当前 macOS 未压缩应用常见位置：`release/mac-arm64/BangumiBar.app`

如需对 `.app` 再压缩分发：

```bash
./scripts/release.sh
```

## 发给试用用户前建议检查

- 应用能正常启动
- 托盘图标显示正常
- 点击托盘后悬浮窗可以正常显示和隐藏
- 设置页可以正常打开和关闭
- OAuth 登录链路正常
- 收藏列表可以正常加载
- 未签名版本的手动放行说明已一并提供给用户

## 发给试用用户时建议附带的信息

- 版本号
- 平台说明，例如 `mac-arm64`
- 是否签名：当前为未签名版本
- 首次打开可能需要手动放行
- 如果无法打开，可参考 `README.md` 中“未签名的 macOS 应用打不开”说明

## 当前已完成的发布收尾

- 已统一构建与打包入口
- 已补齐 `package.json` 的 `author` 与 `license`
- 已接入 `electron-builder` 发布图标
- 已补未签名 macOS 应用的放行说明
- 已整理 README 与当前代码结构、脚本入口的一致性

## 当前仍保留的后续项

- macOS 签名
- macOS 公证
- `webSecurity` / `sandbox` / CSP 的进一步安全收口
- Windows / Linux 实机验证

## 适合进入签名阶段的时机

- 准备给更广泛用户分发
- 希望减少 macOS Gatekeeper 拦截
- 已经不再频繁改动主流程功能

