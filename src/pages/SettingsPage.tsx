type SettingsPageProps = {
  user: any
  appSettings: {
    openAtLogin: boolean
    showNotifications: boolean
    useMirror: boolean
  }
  mirrorHint: string
  isUsingMirror: boolean
  activeSiteWebBase: string
  onClose: () => void
  onOpenUserPage: () => void
  onLogout: () => void
  onUpdateSettings: (settings: Partial<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>) => void
}

export function SettingsPage({
  user,
  appSettings,
  mirrorHint,
  isUsingMirror,
  onClose,
  onOpenUserPage,
  onLogout,
  onUpdateSettings,
}: SettingsPageProps) {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>设置</h2>
        <button className="header-btn" onClick={onClose}>✕</button>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <h3>用户</h3>
          <div className="settings-item">
            {user?.avatar?.medium && <img src={user.avatar.medium} className="avatar" alt="" />}
            <div className="settings-item-info">
              <div className="settings-item-text">{user?.nickname || user?.username}</div>
              <div className="settings-item-hint">@{user?.username}</div>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>账号</h3>
          <div className="settings-item" onClick={onOpenUserPage}>
            <span className="settings-icon">🌐</span>
            <span className="settings-item-text">访问 Bangumi 主页</span>
            <span className="settings-item-hint">↗</span>
          </div>
          <div className="settings-item logout" onClick={onLogout}>
            <span className="settings-icon">🚪</span>
            <span className="settings-item-text">退出登录</span>
          </div>
        </div>
        <div className="settings-section">
          <h3>系统</h3>
          <div className="settings-item toggle-item" onClick={() => onUpdateSettings({ openAtLogin: !appSettings.openAtLogin })}>
            <span className="settings-icon">🚀</span>
            <div className="settings-item-info">
              <div className="settings-item-text">开机自启</div>
              <div className="settings-item-hint">登录时自动启动 BangumiBar</div>
            </div>
            <div className={`toggle-switch ${appSettings.openAtLogin ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
          <div className="settings-item toggle-item" onClick={() => onUpdateSettings({ showNotifications: !appSettings.showNotifications })}>
            <span className="settings-icon">🔔</span>
            <div className="settings-item-info">
              <div className="settings-item-text">新集提醒</div>
              <div className="settings-item-hint">有新集更新时发送通知</div>
            </div>
            <div className={`toggle-switch ${appSettings.showNotifications ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
          <div className="settings-item toggle-item" onClick={() => onUpdateSettings({ useMirror: !appSettings.useMirror })}>
            <span className="settings-icon">🌉</span>
            <div className="settings-item-info">
              <div className="settings-item-text">使用镜像地址</div>
              <div className="settings-item-hint">{mirrorHint}</div>
            </div>
            <div className={`toggle-switch ${appSettings.useMirror ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
          <div className="settings-item">
            <span className="settings-icon">🔗</span>
            <div className="settings-item-info">
              <div className="settings-item-text">当前站点</div>
              <div className="settings-item-hint">{isUsingMirror ? 'bangumi.one / api.bangumi.one' : 'bgm.tv / api.bgm.tv'}</div>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>关于</h3>
          <div className="settings-item">
            <span className="settings-icon">📱</span>
            <span className="settings-item-text">版本</span>
            <span className="settings-item-hint">1.0.0</span>
          </div>
        </div>
      </div>
      <div className="settings-footer">BangumiBar · 追番管理工具</div>
    </div>
  )
}
