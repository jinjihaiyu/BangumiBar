# 重构回归清单

这份清单用于第一阶段等价重构后的手工回归，目标是确认代码边界变化没有影响现有功能。

## 本地运行准备

- 构建前端：`npm run build`
- 本地启动：`BANGUMIBAR_LOCAL_USER_DATA=1 npm run dev`
- 本地日志：`.electron-user-data/bangumibar.log`
- 本地用户数据：`.electron-user-data/`

## 当前已验证

- 主进程可以正常启动并写入日志
- Tray 可以创建成功
- 悬浮窗可以加载 `dist/index.html`
- 渲染进程可以触发 `did-finish-load`
- 首次显示仍会走 `ready-to-show`

## 必须保持一致的行为

- 点击托盘图标后，悬浮窗可以正常显示和隐藏
- 悬浮窗失焦后会自动隐藏
- 设置页可以正常打开和关闭
- OAuth 回调后可以完成登录
- 关闭悬浮窗不会退出应用，托盘菜单中的“退出”可以正常退出
- `openAtLogin`、`showNotifications`、`useMirror` 可以正常读写
- 首次打开悬浮窗时，`ready-to-show` 的显示行为保持不变
- 单实例下再次启动时，`bangumibar://auth` 回调仍能投递到已有窗口

## 每阶段都要复测的流程

1. 启动应用并确认托盘图标显示正常
2. 点击托盘图标，确认悬浮窗显示和收起正常
3. 打开设置页，修改一项设置后重新打开确认值已持久化
4. 关闭窗口后确认应用仍驻留托盘
5. 通过托盘菜单退出应用
6. 如有条件，补测一次 OAuth 登录回调流程
