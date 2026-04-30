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
- **分集进度追踪** — 点击展开番剧卡片，查看每集状态，支持单集/批量标记
- **完结自动打分** — 番剧完结时自动弹出评分窗口，引导你完成打分
- **桌面通知** — 标记集数为看过时，发送 macOS 桌面通知
- **一键直达 Bangumi** — 点击任意条目直接跳转到 Bangumi 页面
- **搜索过滤** — 实时搜索番剧名称，支持在看/想看联合搜索
- **开机自启** — 可配置登录时自动启动
- **设置中心** — 简洁的设置面板，管理登录状态和偏好选项

### 用户体验

- **智能排序** — 有待看内容的番剧优先显示，未完结番剧排在前面
- **多选操作** — 支持 Shift/Cmd/Ctrl 多选集数，批量标记状态
- **右键菜单** — 集数右键快速操作
- **悬停预览** — 鼠标悬停集数圆点显示集名和播出日期
- **登录令牌自动刷新** — 无需手动重新授权

---

## 项目结构

```
BangumiBar/
├── electron/               # Electron 主进程代码
│   ├── main.js            # 主进程入口（窗口/托盘/IPC）
│   ├── preload.js         # 预加载脚本（安全的 Bridge）
│   ├── icon.png           # 菜单栏图标 (16x16)
│   └── icon@2x.png       # 菜单栏图标 Retina (32x32)
├── src/                    # React 前端源代码
│   ├── main.tsx           # React 入口 + 错误边界
│   ├── App.tsx           # 主应用组件（含所有子组件）
│   ├── utils.ts          # 工具函数（日期/进度计算）
│   ├── index.css         # 全局样式
│   └── electron.d.ts     # Electron API 类型声明
├── scripts/               # 构建脚本
│   └── build.sh          # 打包脚本（清理+构建+打包）
├── index.html             # HTML 入口
├── package.json           # 项目配置
├── vite.config.ts         # Vite 构建配置
├── tsconfig.json          # TypeScript 配置
├── .gitignore             # Git 忽略配置
├── archive/               # 历史废弃文件（已不使用）
│   └── (旧版 package-lock 文件等)
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

- **前端日志**：`src/main.tsx` 中有全局错误捕获和 `console.log` 输出
- **主进程日志**：运行时会写入 `~/Library/Application Support/BangumiBar/bangumibar.log`
- **React DevTools**：可在 `BrowserWindow` 中打开 DevTools 进行前端调试

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

#### 方式二：手动命令

```bash
# 1. 清理
rm -rf dist/ release/

# 2. 构建前端
npm run build

# 3. 打包（--dir 生成未压缩目录，不加生成 dmg）
npm run build:app
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
| 分集进度标记 | ✅ 完成 | 单集/批量标记 |
| 完结自动评分 | ✅ 完成 | 完结后弹出评分窗口 |
| 桌面通知 | ✅ 完成 | 标记后发送通知 |
| 搜索过滤 | ✅ 完成 | 实时搜索 |
| 开机自启 | ✅ 完成 | 设置中可配置 |
| 多语言支持 | 🔜 待做 | i18n |
| 自动更新 | 🔜 待做 | electron-updater |
| Windows/Linux 适配 | 🔜 待做 | 尚未测试 |

---

## 常见问题

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
