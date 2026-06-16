import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

type ErrorBoundaryProps = React.PropsWithChildren

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
  info: React.ErrorInfo | null
}

window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.message, 'at', e.filename, 'line', e.lineno, 'col', e.colno)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason)
})

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
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

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
} catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e))
  console.error('[main.tsx] render FAILED:', error.message, error.stack)
}
