type LoginPageProps = {
  tokenExpired: boolean
  authLoading: boolean
  showManualCode: boolean
  manualCode: string
  onOpenAuthPage: () => void
  onShowManualCode: (visible: boolean) => void
  onManualCodeChange: (value: string) => void
  onManualCodeSubmit: () => void
}

export function LoginPage({
  tokenExpired,
  authLoading,
  showManualCode,
  manualCode,
  onOpenAuthPage,
  onShowManualCode,
  onManualCodeChange,
  onManualCodeSubmit,
}: LoginPageProps) {
  return (
    <div className="login-page">
      {tokenExpired && <div className="login-expired-banner"><span>登录已过期，请重新登录</span></div>}
      <div className="login-logo">🎬</div>
      <h1 className="login-title">BangumiBar</h1>
      <p className="login-subtitle">管理你的追番列表</p>
      <button className="login-btn" onClick={onOpenAuthPage} disabled={authLoading}>
        {authLoading ? '授权中...' : '授权登录'}
      </button>
      <p className="login-hint">点击后将打开浏览器进行授权</p>
      <button className="login-link" onClick={() => onShowManualCode(true)}>手动输入授权码</button>
      {showManualCode && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>输入授权码</h3>
            <input
              type="text"
              placeholder="请输入授权码"
              value={manualCode}
              onChange={event => onManualCodeChange(event.target.value)}
              onKeyUp={event => event.key === 'Enter' && onManualCodeSubmit()}
            />
            <div className="modal-buttons">
              <button onClick={() => onShowManualCode(false)}>取消</button>
              <button className="primary" onClick={onManualCodeSubmit}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
