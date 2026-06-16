# BangumiBar v1.1.0

## 版本简介

本版本主要用于完成近期重构后的首次发布收尾，重点是把当前项目整理到一个更适合继续维护和分发的状态。

## 主要更新

- 完成 Electron 主进程、preload、页面与业务代码的结构拆分，项目目录更清晰
- 统一构建与打包入口，支持通过 `package.json` 脚本和 `scripts/build.sh` 进行一致的发布流程
- 修复并整理发布链路，补齐 `release.sh` 的自动探测与归档逻辑
- 接入正式发布图标资源，移除默认 Electron 图标用于发布包的问题
- 清理启动调试日志，补充发布文档、发布清单与未签名版本的使用说明

## 发布资产

- `BangumiBar-1.1.0-arm64.dmg`
- `BangumiBar-1.1.0-mac-arm64.zip`
- `BangumiBar-1.1.0-mac-arm64.tar.gz`

## 已知说明

- 当前 macOS 版本仍为未签名版本
- 首次打开时，系统可能提示无法验证开发者，需要在 macOS 中手动放行
- Windows 与 Linux 打包入口已保留，但本次发布资产以当前机器生成的 macOS arm64 版本为主
