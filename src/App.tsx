import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import { useAppSettings } from './app/hooks/useAppSettings'
import { useAuth } from './app/hooks/useAuth'
import { useCollections } from './app/hooks/useCollections'
import { desktopApi } from './platform/desktop-api'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { MainPage } from './pages/MainPage'

const SUBJECT_TYPES = [
  { value: 2, label: '动画', icon: '🎬' },
  { value: 1, label: '书籍', icon: '📚' },
  { value: 4, label: '游戏', icon: '🎮' }
]

const getSubjectId = (item: any): number => item.subjectId || item.subject?.id || item.subject_id
// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'settings'>('main')
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; subjectId: number; episodeId: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusEditItem, setStatusEditItem] = useState<{ subject: any; subjectType: number; collectionItem: any } | null>(null)
  const [hoveredEp, setHoveredEp] = useState<{ x: number; y: number; ep: any } | null>(null)
  const onAuthenticatedRef = useRef<(payload: { token: string; username: string; force: boolean }) => Promise<void>>(async () => {})

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const {
    appSettings,
    activeSite,
    initializeSettings,
    updateAppSettings,
    isUsingMirror,
    mirrorHint,
  } = useAppSettings()

  const {
    isLoggedIn,
    isLoading: authLoading,
    user,
    username,
    showManualCode,
    manualCode,
    tokenExpired,
    setShowManualCode,
    setManualCode,
    getValidToken,
    openAuthPage,
    handleCallback,
    submitManualCode,
    checkLogin,
    logout: authLogout,
  } = useAuth()

  const {
    selectedFilter,
    selectedSubjectType,
    collections,
    searchCorpus,
    isLoading,
    error,
    notificationCount,
    notifications,
    showNotifications,
    unwatchedCounts,
    setSelectedFilter,
    setSelectedSubjectType,
    setShowNotifications,
    loadCollections,
    loadSearchCorpus,
    resetCollectionState,
    markEpisode,
    handleStatusEdit,
    handleRefreshCollections,
    handleUnwatchedUpdate,
    clearNotifications,
  } = useCollections({
    username,
    isLoggedIn,
    getValidToken,
    getSubjectId,
    onToast: showToast,
  })

  useEffect(() => {
    onAuthenticatedRef.current = async ({ username: nextUsername, force }) => {
      await loadCollections({ force, usernameOverride: nextUsername })
      await loadSearchCorpus(nextUsername)
    }
  }, [loadCollections, loadSearchCorpus])

  const handleAuthCallback = useCallback((data: any) => {
    void handleCallback(data, payload => onAuthenticatedRef.current(payload))
  }, [handleCallback])

  const handleManualCodeSubmit = useCallback(() => {
    submitManualCode(payload => onAuthenticatedRef.current(payload))
  }, [submitManualCode])

  const logout = useCallback(() => {
    authLogout()
    resetCollectionState()
    setStatusEditItem(null)
  }, [authLogout, resetCollectionState])

  const onStatusEditSubmit = useCallback(async (data: { type?: number; rating?: number; comment?: string }) => {
    await handleStatusEdit(statusEditItem, data)
  }, [handleStatusEdit, statusEditItem])

  // ─── UI handlers ─────────────────────────────────────────────────────────

  const showEpisodeMenu = (e: React.MouseEvent, subjectId: number, episodeId: number) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setContextMenu({ x: rect.left, y: rect.bottom + 4, subjectId, episodeId })
  }

  const toggleCard = (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    const subjectId = getSubjectId(item)
    setExpandedCard(prev => prev === subjectId ? null : subjectId)
  }

  const openBangumiSubject = (subjectId: number) => {
    desktopApi.openExternal(`${activeSite.webBase}/subject/${subjectId}`)
  }

  // ─── Filter & sort ────────────────────────────────────────────────────────

  const filteredCollections = searchQuery.trim()
    ? collections.filter(item => {
        const name = item.subject?.nameCn || item.subject?.name || ''
        const nameRaw = item.subject?.name || ''
        const q = searchQuery.toLowerCase()
        return name.toLowerCase().includes(q) || nameRaw.toLowerCase().includes(q)
      })
    : collections

  const searchResults = searchQuery.trim()
    ? searchCorpus.filter(item => {
        const name = item.subject?.nameCn || item.subject?.name || ''
        const nameRaw = item.subject?.name || ''
        const q = searchQuery.toLowerCase()
        return name.toLowerCase().includes(q) || nameRaw.toLowerCase().includes(q)
      })
    : []

  const sortedCollections = [...filteredCollections].sort((a, b) => {
    const aid = getSubjectId(a), bid = getSubjectId(b)
    const aUnwatched = unwatchedCounts[aid] || 0
    const bUnwatched = unwatchedCounts[bid] || 0
    const aEnded = a.subject?.endDate && new Date(a.subject.endDate) < new Date()
    const bEnded = b.subject?.endDate && new Date(b.subject.endDate) < new Date()
    // 1. 有待看 > 无待看
    if ((aUnwatched > 0) !== (bUnwatched > 0)) return aUnwatched > 0 ? -1 : 1
    // 2. 未完结 > 已完结
    if (aEnded !== bEnded) return aEnded ? 1 : -1
    return 0
  })

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    const initApp = async () => {
      if (window.location.hash === '#settings') setCurrentPage('settings')
      desktopApi.onAuthCallback(handleAuthCallback)
      await initializeSettings()
      if (cancelled) return

      await checkLogin(payload => onAuthenticatedRef.current(payload))
    }

    void initApp()
    return () => { cancelled = true }
  }, [checkLogin, handleAuthCallback, initializeSettings])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ─── Render: Login ───────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <LoginPage
        tokenExpired={tokenExpired}
        authLoading={authLoading}
        showManualCode={showManualCode}
        manualCode={manualCode}
        onOpenAuthPage={openAuthPage}
        onShowManualCode={setShowManualCode}
        onManualCodeChange={setManualCode}
        onManualCodeSubmit={handleManualCodeSubmit}
      />
    )
  }

  // ─── Render: Settings ─────────────────────────────────────────────────────

  if (currentPage === 'settings') {
    return (
      <SettingsPage
        user={user}
        appSettings={appSettings}
        mirrorHint={mirrorHint}
        isUsingMirror={isUsingMirror}
        activeSiteWebBase={activeSite.webBase}
        onClose={() => setCurrentPage('main')}
        onOpenUserPage={() => desktopApi.openExternal(`${activeSite.webBase}/user/${user?.username}`)}
        onLogout={logout}
        onUpdateSettings={updateAppSettings}
      />
    )
  }

  // ─── Render: Main ────────────────────────────────────────────────────────

  return (
    <MainPage
      user={user}
      tokenExpired={tokenExpired}
      notificationCount={notificationCount}
      showNotifications={showNotifications}
      notifications={notifications}
      searchQuery={searchQuery}
      selectedFilter={selectedFilter}
      selectedSubjectType={selectedSubjectType}
      subjectTypes={SUBJECT_TYPES}
      searchResults={searchResults}
      filteredCollections={filteredCollections}
      sortedCollections={sortedCollections}
      isLoading={isLoading}
      error={error}
      expandedCard={expandedCard}
      unwatchedCounts={unwatchedCounts}
      contextMenu={contextMenu}
      hoveredEp={hoveredEp}
      statusEditItem={statusEditItem}
      toast={toast}
      onOpenSettings={() => setCurrentPage('settings')}
      onToggleNotifications={setShowNotifications}
      onSearchChange={setSearchQuery}
      onClearSearch={() => setSearchQuery('')}
      onSelectFilter={setSelectedFilter}
      onRefreshCollections={handleRefreshCollections}
      onSelectSubjectType={setSelectedSubjectType}
      onToggleCard={toggleCard}
      onMarkEpisode={markEpisode}
      onOpenSubject={openBangumiSubject}
      onShowEpisodeMenu={showEpisodeMenu}
      setHoveredEp={setHoveredEp}
      onUnwatchedUpdate={handleUnwatchedUpdate}
      onEditStatus={(subject, st, colItem) => setStatusEditItem({ subject, subjectType: st, collectionItem: colItem })}
      clearNotifications={clearNotifications}
      onCloseContextMenu={() => setContextMenu(null)}
      onCloseStatusEdit={() => setStatusEditItem(null)}
      onSubmitStatusEdit={onStatusEditSubmit}
    />
  )
}

export default App
