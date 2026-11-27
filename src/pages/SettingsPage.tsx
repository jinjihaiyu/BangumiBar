import { useEffect, useState } from 'react'
import { DEFAULT_MIRROR_DOMAIN, cleanMirrorDomainInput, isValidMirrorDomain, normalizeMirrorDomain, type AppSettings } from '../app/services/settings-service'

type SettingsPageProps = {
  user: any
  appSettings: AppSettings
  mirrorHint: string
  isUsingMirror: boolean
  activeSiteWebBase: string
  onClose: () => void
  onOpenUserPage: () => void
  onLogout: () => void
  onUpdateSettings: (settings: Partial<AppSettings>) => void
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
  const savedDomain = normalizeMirrorDomain(appSettings.mirrorDomain)
  const [domainInput, setDomainInput] = useState(savedDomain)
  const [domainError, setDomainError] = useState('')
  const [domainSaved, setDomainSaved] = useState(false)

  useEffect(() => {
    setDomainInput(savedDomain)
  }, [savedDomain])

  const handleSaveDomain = () => {
    const cleaned = cleanMirrorDomainInput(domainInput)
    if (!cleaned) {
      setDomainInput(DEFAULT_MIRROR_DOMAIN)
      setDomainError('')
      onUpdateSettings({ mirrorDomain: DEFAULT_MIRROR_DOMAIN })
      setDomainSaved(true)
      window.setTimeout(() => setDomainSaved(false), 1500)
      return
    }

    if (!isValidMirrorDomain(cleaned)) {
      setDomainError('请输入有效域名，例如 bangumi.one')
      return
    }

    setDomainError('')
    setDomainInput(cleaned)
    onUpdateSettings({ mirrorDomain: cleaned })
    setDomainSaved(true)
    window.setTimeout(() => setDomainSaved(false), 1500)
  }

  const handleResetDomain = () => {
    setDomainError('')
    setDomainInput(DEFAULT_MIRROR_DOMAIN)
    onUpdateSettings({ mirrorDomain: DEFAULT_MIRROR_DOMAIN })
    setDomainSaved(true)
    window.setTimeout(() => setDomainSaved(false), 1500)
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>设置</h2>
        <button className="header-btn" onClick={onClose} aria-label="关闭设置">✕</button>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <h3>用户</h3>
          <div className="settings-item static">
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
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="settings-item-text">访问 Bangumi 主页</span>
            <span className="settings-item-hint">↗</span>
          </div>
          <div className="settings-item logout" onClick={onLogout}>
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="settings-item-text">退出登录</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>系统</h3>
          <div className="settings-item toggle-item" onClick={() => onUpdateSettings({ openAtLogin: !appSettings.openAtLogin })}>
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
            <div className="settings-item-info">
              <div className="settings-item-text">开机自启</div>
              <div className="settings-item-hint">登录时自动启动 BangumiBar</div>
            </div>
            <div className={`toggle-switch ${appSettings.openAtLogin ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="settings-item toggle-item" onClick={() => onUpdateSettings({ showNotifications: !appSettings.showNotifications })}>
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="settings-item-info">
              <div className="settings-item-text">新集提醒</div>
              <div className="settings-item-hint">标记看过时发送桌面通知</div>
            </div>
            <div className={`toggle-switch ${appSettings.showNotifications ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="settings-item toggle-item" onClick={() => onUpdateSettings({ useMirror: !appSettings.useMirror })}>
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            <div className="settings-item-info">
              <div className="settings-item-text">使用镜像地址</div>
              <div className="settings-item-hint">{mirrorHint}</div>
            </div>
            <div className={`toggle-switch ${appSettings.useMirror ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="settings-item settings-domain-card static">
            <div className="settings-domain-header">
              <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <div className="settings-item-info">
                <div className="settings-item-text">镜像域名</div>
                <div className="settings-item-hint">留空或点击重置将恢复默认 {DEFAULT_MIRROR_DOMAIN}</div>
              </div>
            </div>
            <div className="settings-domain-row">
              <input
                type="text"
                className="settings-domain-input"
                value={domainInput}
                placeholder={DEFAULT_MIRROR_DOMAIN}
                onChange={event => {
                  setDomainInput(event.target.value)
                  if (domainError) setDomainError('')
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') handleSaveDomain()
                }}
              />
              <button type="button" className="settings-domain-btn primary" onClick={handleSaveDomain}>
                {domainSaved ? '已保存' : '保存'}
              </button>
              {savedDomain !== DEFAULT_MIRROR_DOMAIN && (
                <button type="button" className="settings-domain-btn" onClick={handleResetDomain}>
                  重置
                </button>
              )}
            </div>
            {domainError && <div className="settings-domain-error">{domainError}</div>}
          </div>

          <div className="settings-item static">
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <div className="settings-item-info">
              <div className="settings-item-text">当前站点</div>
              <div className="settings-item-hint">
                {isUsingMirror ? `${savedDomain} / api.${savedDomain}` : 'bgm.tv / api.bgm.tv'}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>关于</h3>
          <div className="settings-item static">
            <svg className="settings-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="settings-item-text">版本</span>
            <span className="settings-item-hint">{__APP_VERSION__}</span>
          </div>
        </div>
      </div>
      <div className="settings-footer">BangumiBar · 追番管理工具</div>
    </div>
  )
}
