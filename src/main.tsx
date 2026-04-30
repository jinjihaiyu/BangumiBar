import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.message, 'at', e.filename, 'line', e.lineno, 'col', e.colno)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason)
})

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    this.setState({ error, info })
    console.error('[React ErrorBoundary caught]', error?.message, error?.stack, info?.componentStack)
    try {
      ;(window as any).electronAPI?.showNotification?.('BangumiBar 崩溃', error?.message || String(error))
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#ff453a', fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>渲染崩溃</div>
          <div style={{ color: '#fff', marginBottom: 4 }}>{String(this.state.error)}</div>
          <pre style={{ color: '#888', fontSize: 10, whiteSpace: 'pre-wrap' }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

console.log('[main.tsx] Starting render...')
try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
  console.log('[main.tsx] render() called successfully')
} catch(e) {
  console.error('[main.tsx] render FAILED:', e.message, e.stack)
}
