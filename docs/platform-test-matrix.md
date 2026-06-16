# 三平台验证矩阵

这份清单用于 `macOS / Windows / Linux` 的手工回归，重点验证悬浮窗、托盘和协议回调是否符合预期。

## 测试维度

- `Tray`：托盘图标是否显示、左键点击是否能显示和隐藏悬浮窗
- `Popover Position`：悬浮窗是否贴近托盘，并且不会飞出屏幕工作区
- `Blur Hide`：悬浮窗失焦后是否会自动隐藏
- `Settings`：设置页能否打开，`openAtLogin / showNotifications / useMirror` 是否能保存
- `OAuth Callback`：浏览器授权后，`bangumibar://auth` 是否能回到应用并完成登录
- `Single Instance`：应用已启动时再次拉起，回调是否能投递到已有实例
- `Notifications`：新集提醒能否正常显示
- `Quit Behavior`：关闭悬浮窗后是否仍驻留托盘，托盘菜单是否可退出
- `Open At Login`：开机启动设置是否能写入并在目标平台生效

## macOS

- `Tray`：确认菜单栏图标正常显示
- `Popover Position`：确认弹窗位于菜单栏图标下方或附近，位置与当前版本保持一致
- `Blur Hide`：点击其他区域后确认悬浮窗隐藏
- `Settings`：修改设置后重新打开应用确认值被持久化
- `OAuth Callback`：浏览器授权后确认能回到已运行实例
- `Single Instance`：重复启动应用确认不会出现第二个实例
- `Notifications`：确认系统通知能显示
- `Quit Behavior`：关闭悬浮窗不退出，托盘菜单“退出”可关闭应用
- `Open At Login`：确认登录项状态与设置一致

## Windows

- `Tray`：确认系统托盘图标显示正常
- `Popover Position`：分别验证任务栏在底部、顶部或侧边时，悬浮窗不会超出工作区
- `Blur Hide`：切换到其他窗口后确认悬浮窗隐藏
- `Settings`：修改设置后重启应用确认值被持久化
- `OAuth Callback`：确认 `bangumibar://auth` 可以唤起应用并完成登录
- `Single Instance`：应用已运行时，协议回调应进入已有实例
- `Notifications`：确认通知可见
- `Quit Behavior`：关闭悬浮窗不退出，右键托盘菜单仍可退出
- `Open At Login`：确认设置开关后系统登录项行为符合预期

## Linux

- `Tray`：确认当前桌面环境支持托盘图标显示
- `Popover Position`：确认顶部、底部或侧边面板场景下，悬浮窗尽量贴边且不出屏
- `Blur Hide`：切换到其他窗口后确认悬浮窗隐藏
- `Settings`：修改设置后重启应用确认值被持久化
- `OAuth Callback`：确认 `bangumibar://auth` 在目标发行版与桌面环境下可回调应用
- `Single Instance`：应用已运行时，协议回调应进入已有实例
- `Notifications`：确认桌面通知服务可正常显示提醒
- `Quit Behavior`：关闭悬浮窗不退出，托盘菜单仍可退出
- `Open At Login`：根据桌面环境确认登录项是否生效，并记录不支持的发行版差异

## 协议回调专项检查

- `首次启动回调`：应用未启动时直接访问 `bangumibar://auth?code=...`，确认应用启动后可以完成登录
- `已启动回调`：应用已启动时再次访问协议地址，确认回调进入已有实例，不出现第二个窗口
- `窗口未就绪回调`：在应用启动过程中尽快触发协议回调，确认登录结果会在窗口加载完成后补发
