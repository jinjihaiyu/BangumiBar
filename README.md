# BangumiBar

本项目完全有ai开发（消耗即将过期token的产物），没有经过全面的测试，可预计的会有奇奇怪怪的bug。主要目的是快速管理在看状态的动画列表，其他功能并未深入开发。如果遇到bug或者有优化的想法可以和我交流，应该会看到233.只有这段话是我手写的，剩下都是ai了。

一个优雅的 macOS 菜单栏追番管理工具，深度集成 [Bangumi](https://bgm.tv/) API，让你在菜单栏上随时掌握追番进度。

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/Electron-28-green)
![React](https://img.shields.io/badge/React-18-blue)

---

## 功能特性

### 核心功能

- **菜单栏驻留** — 应用常驻 macOS 菜单栏，点击即现，不占用 Dock 图标
- **追番列表管理** — 支持动画、书籍、游戏三种条目类型，查看在看/想看列表
- **分集进度追踪** — 点击展开番剧卡片，查看每集状态，支持单集标记
- **完结快速补评** — 点完最后一集后自动弹出“修改条目”窗口，便于直接标记看过、打分和吐槽
- **桌面通知** — 标记集数为看过时，发送 macOS 桌面通知
- **一键直达 Bangumi** — 点击任意条目直接跳转到 Bangumi 页面
- **搜索过滤** — 实时搜索番剧名称，支持在看/想看联合搜索
- **开机自启** — 可配置登录时自动启动
- **设置中心** — 简洁的设置面板，管理登录状态和偏好选项

### 用户体验

- **智能排序** — 有待看内容的番剧优先显示，未完结番剧排在前面
- **右键菜单** — 集数右键快速操作
- **悬停预览** — 鼠标悬停集数圆点显示集名和播出日期
- **登录令牌自动刷新** — 无需手动重新授权

---

## 项目结构

```text
BangumiBar/
├── electron/                   # Electron 壳层代码
│   ├── main.js                 # 主进程入口
│   ├── preload.js              # preload 统一入口
│   ├── main/                   # 主进程控制器与平台适配
│   │   ├── window-controller.js
│   │   ├── tray-controller.js
│   │   ├── protocol-controller.js
│   │   ├── ipc.js
│   │   └── platform/
│   ├── preload/                # 桥接能力拆分
│   │   ├── bridge.js
│   │   ├── auth.js
│   │   ├── desktop.js
│   │   └── settings.js
│   ├── icon.png
│   └── icon@2x.png
├── src/                        # React 渲染层
│   ├── app/
│   │   ├── hooks/              # 状态与副作用组织
│   │   └── services/           # API / 设置 / 缓存服务
│   ├── components/             # 展示组件
│   ├── pages/                  # 页面层
│   ├── platform/               # renderer 侧桌面能力入口
│   ├── App.tsx                 # 顶层编排
│   ├── main.tsx                # React 入口 + 错误边界
│   ├── utils.ts                # 通用工具函数
│   ├── index.css
│   └── electron.d.ts
├── docs/                       # 重构、验证与发布收尾文档
├── scripts/
│   ├── build.sh                # 构建与打包脚本
│   └── release.sh              # 将 `.app` 再压缩为发布包
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 框架 | Electron 28 | 跨平台桌面应用框架 |
| 前端 | React 18 | UI 组件化开发 |
| 构建 | Vite 5 | 极速前端构建工具 |
| 语言 | TypeScript 5 | 类型安全 |
| 打包 | electron-builder | 应用打包分发 |
| 存储 | electron-store | 轻量持久化存储 |
| API | Bangumi v0 API | 番剧数据接口 |

---

## 开发环境

### 环境要求

- **Node.js** >= 18.x
- **npm** >= 9.x
- **macOS** 10.15+（主要测试平台）
- **Xcode Command Line Tools**（macOS 开发）

### 安装依赖

```bash
cd BangumiBar
npm install
```

### 开发模式

```bash
npm run dev
```

> 这会执行 Vite 构建，然后启动 Electron 窗口。

### 项目调试

- **前端日志**：`src/main.tsx` 中保留了全局错误捕获，便于定位渲染异常
- **主进程日志**：运行时会写入 `~/Library/Application Support/BangumiBar/bangumibar.log`
- **React DevTools**：可在 `BrowserWindow` 中打开 DevTools 进行前端调试

## 安全配置待办

当前为了保证本地 `preload` 桥接和现有页面加载链路稳定，Electron 窗口配置里仍保留了少量偏宽松设置。它们不会阻塞当前开发和使用，但在后续发布前建议逐步收口：

- `webSecurity: false`
  - 当前位置：`electron/main/window-controller.js`
  - 待办：确认当前页面实际依赖后，恢复为默认安全值，避免继续触发 Electron 的安全告警
- `sandbox: false`
  - 当前位置：`electron/main/window-controller.js`
  - 原因：当前拆分后的 `preload.js` 仍依赖 CommonJS `require('./preload/bridge')`
  - 待办：后续可以把 preload 构建链路独立出来，改成不依赖运行时 `require`，再评估恢复 sandbox
- Content Security Policy
  - 现状：当前页面没有完整收口 CSP，因此仍会看到相关安全提示
  - 待办：为 `index.html` 和渲染资源补明确的 CSP，收紧脚本与资源来源

建议顺序：先收口 `preload` 构建方式，再恢复 `sandbox`；随后处理 `webSecurity` 和 CSP，这样对现有功能影响最小。

## 发布元信息待办

- `package.json` 已补 `author` 与 `license`，可消除 `electron-builder` 的作者缺失提示
- 当前发布图标资源已接入 `build/` 目录：
  - macOS：`build/icon.icns`
  - Windows：`build/icon.ico`
  - Linux：`build/icon.png`
- `electron/icon.png` 与 `electron/icon@2x.png` 仍保留为托盘图标资源
- 若后续想替换发布图标，建议继续提供一张高分辨率正方形源图，再重新生成 `build/` 下的标准图标文件

### 构建打包

#### 方式一：使用脚本（推荐）

```bash
# 清理旧包并打包当前平台
./scripts/build.sh

# 仅打包指定平台
./scripts/build.sh --mac    # 仅 macOS
./scripts/build.sh --win    # 仅 Windows
./scripts/build.sh --linux  # 仅 Linux

# 仅清理旧产物
./scripts/build.sh --clean-only
```

如需对已生成的 `.app` 做额外压缩分发，可使用：

```bash
./scripts/release.sh
```

脚本会自动在 `release/` 中查找 `BangumiBar.app`，并将压缩产物输出到 `release-artifacts/`。

#### 方式二：手动命令

```bash
# 1. 清理构建产物
npm run clean

# 2. 构建前端
npm run build

# 3. 打包未压缩目录
npm run pack:dir

# 或按平台打包
npm run pack:mac
npm run pack:win
npm run pack:linux
```

### 打包产物

macOS 打包完成后，产物位于 `release/mac-arm64/BangumiBar.app`。

运行应用：

```bash
open release/mac-arm64/BangumiBar.app
```

或：

```bash
./release/mac-arm64/BangumiBar.app/Contents/MacOS/BangumiBar
```

---

## 功能进度

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 菜单栏托盘 | ✅ 完成 | 点击显示/隐藏 Popover |
| OAuth 登录 | ✅ 完成 | Bangumi OAuth 2.0 |
| 追番列表展示 | ✅ 完成 | 支持在看/想看/看过/书籍/游戏 |
| 分集进度标记 | ✅ 完成 | 单集点击标记 |
| 完结快速补评 | ✅ 完成 | 最后一集完成后直接弹出修改条目窗口 |
| 桌面通知 | ✅ 完成 | 标记后发送通知 |
| 搜索过滤 | ✅ 完成 | 实时搜索 |
| 开机自启 | ✅ 完成 | 设置中可配置 |
| 多语言支持 | 🔜 待做 | i18n |
| 自动更新 | 🔜 待做 | electron-updater |
| Windows/Linux 适配 | 🔜 待做 | 尚未测试 |

---

## 常见问题

### Q: 未签名的 macOS 应用打不开，提示“无法验证开发者”怎么办？

如果当前分发的是未签名版本，macOS 可能会默认拦截。这不一定代表应用有问题，通常按下面步骤手动放行即可：

```text
1. 先双击一次应用，让系统弹出拦截提示
2. 打开「系统设置」->「隐私与安全性」
3. 在页面下方找到关于 BangumiBar 的拦截提示
4. 点击「仍要打开」或同类放行按钮
5. 再次启动应用
```

如果系统没有出现放行按钮，也可以尝试：

```text
1. 在 Finder 中找到 BangumiBar.app
2. 右键应用，选择「打开」
3. 在弹窗中再次点击「打开」
```

说明：

- 这种情况常见于未签名的测试版应用
- 对熟悉 macOS 的试用用户通常问题不大
- 如果后续要面向更广泛用户分发，建议再补签名与公证流程

### Q: 应用无法显示图标？

确保 `electron/icon.png` 和 `electron/icon@2x.png` 存在且格式正确。Vite 打包后图标文件不会被复制，请确认构建时图标在 `electron/` 目录下。

### Q: 登录后显示"获取用户信息失败"？

请检查 Bangumi 账号的 OAuth 授权是否有效，以及网络是否能访问 `api.bgm.tv`。

### Q: 如何彻底卸载？

```bash
# 删除应用
rm -rf /Applications/BangumiBar.app

# 删除用户数据（包含登录状态和缓存）
rm -rf ~/Library/Application\ Support/BangumiBar
rm -rf ~/Library/Preferences/com.bangumibar.app.plist
```

---

## License

MIT © jinjihaiyu
