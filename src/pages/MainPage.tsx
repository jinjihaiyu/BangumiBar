import { AnimeCard } from '../components/AnimeCard'
import { StatusEditModal } from '../components/StatusEditModal'
import { COLLECTION_STATUS_VALUES, formatTime, getCollectionStatusLabel, getSubjectId, getUserRating } from '../utils'

type SubjectTypeOption = {
  value: number
  label: string
  icon: string
}

type MainPageProps = {
  user: any
  tokenExpired: boolean
  notificationCount: number
  showNotifications: boolean
  notifications: Array<{ id: number; type: 'progress' | 'rating'; text: string; time: Date; subjectName: string; subjectId?: number }>
  searchQuery: string
  selectedFilter: number
  selectedSubjectType: number
  showChineseTitle: boolean
  subjectTypes: SubjectTypeOption[]
  searchResults: any[]
  filteredCollections: any[]
  sortedCollections: any[]
  isLoading: boolean
  error: string | null
  expandedCard: number | null
  unwatchedCounts: Record<number, number>
  scheduleMap: Record<number, number>
  scheduleUnavailable: boolean
  contextMenu: {
    x: number
    y: number
    subjectId: number
    episodeId: number
    episodeNumber: number
    onSelect: (newType: number) => void
    onWatchUpTo: () => void
  } | null
  hoveredEp: { x: number; y: number; ep: any } | null
  statusEditItem: { subject: any; subjectType: number; collectionItem: any } | null
  toast: string | null
  onOpenSettings: () => void
  onToggleNotifications: (updater: (current: boolean) => boolean) => void
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onSelectFilter: (value: number) => void
  onRefreshCollections: () => void
  onSelectSubjectType: (value: number) => void
  onToggleTitleLanguage: () => void
  onToggleCard: (event: React.MouseEvent, item: any) => void
  onMarkEpisode: (subjectId: number, episodeId: number, newType: number, episodeNumber?: number) => Promise<boolean>
  onMarkEpisodesUpTo: (subjectId: number, episodeIds: number[], upToEpisodeNumber?: number) => Promise<boolean>
  onOpenSubject: (subjectId: number) => void
  onShowEpisodeMenu: (
    event: React.MouseEvent,
    subjectId: number,
    episodeId: number,
    episodeNumber: number,
    actions: { onSelect: (newType: number) => void; onWatchUpTo: () => void }
  ) => void
  setHoveredEp: React.Dispatch<React.SetStateAction<{ x: number; y: number; ep: any } | null>>
  onUnwatchedUpdate: (subjectId: number, count: number) => void
  onEditStatus: (subject: any, subjectType: number, collectionItem: any) => void
  clearNotifications: () => void
  onCloseContextMenu: () => void
  onCloseStatusEdit: () => void
  onSubmitStatusEdit: (data: { type?: number; rating?: number; comment?: string }) => Promise<void> | void
}

export function MainPage({
  user,
  tokenExpired,
  notificationCount,
  showNotifications,
  notifications,
  searchQuery,
  selectedFilter,
  selectedSubjectType,
  showChineseTitle,
  subjectTypes,
  searchResults,
  filteredCollections,
  sortedCollections,
  isLoading,
  error,
  expandedCard,
  unwatchedCounts,
  scheduleMap,
  scheduleUnavailable,
  contextMenu,
  hoveredEp,
  statusEditItem,
  toast,
  onOpenSettings,
  onToggleNotifications,
  onSearchChange,
  onClearSearch,
  onSelectFilter,
  onRefreshCollections,
  onSelectSubjectType,
  onToggleTitleLanguage,
  onToggleCard,
  onMarkEpisode,
  onMarkEpisodesUpTo,
  onOpenSubject,
  onShowEpisodeMenu,
  setHoveredEp,
  onUnwatchedUpdate,
  onEditStatus,
  clearNotifications,
  onCloseContextMenu,
  onCloseStatusEdit,
  onSubmitStatusEdit,
}: MainPageProps) {
  const activeTypeLabel = subjectTypes.find(t => t.value === selectedSubjectType)?.label || '条目'
  const doingLabel = getCollectionStatusLabel(3, selectedSubjectType)
  const wishLabel = getCollectionStatusLabel(1, selectedSubjectType)

  return (
    <div className="page">
      <div className="header">
        {user?.avatar?.medium && <img src={user.avatar.medium} className="header-avatar" alt="" />}
        <div className="header-info">
          <div className="header-nickname">{user?.nickname || user?.username || '用户'}</div>
          <div className="header-sub">{tokenExpired ? '登录过期' : '在线'}</div>
        </div>
        <div className="header-actions">
          {notificationCount > 0 && (
            <button className="notif-badge-btn" onClick={() => onToggleNotifications(value => !value)} title="查看通知">
              {notificationCount > 99 ? '99+' : notificationCount}
            </button>
          )}
          <button className="header-btn" onClick={onOpenSettings} title="设置" aria-label="设置">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="search-bar">
        <svg className="search-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder={`搜索${activeTypeLabel}...`}
          value={searchQuery}
          onChange={event => onSearchChange(event.target.value)}
        />
        {searchQuery && <button className="search-clear" onClick={onClearSearch} aria-label="清空搜索">✕</button>}
      </div>

      {/* 一级大类：动画 / 书籍 / 游戏（macOS Segmented Control 风格） */}
      <div className="type-bar">
        <div className="type-segmented" role="tablist" aria-label="条目类型">
          {subjectTypes.map(subjectType => (
            <button
              key={subjectType.value}
              type="button"
              role="tab"
              aria-selected={selectedSubjectType === subjectType.value}
              className={`type-segment ${selectedSubjectType === subjectType.value ? 'active' : ''}`}
              onClick={() => onSelectSubjectType(subjectType.value)}
            >
              {subjectType.label}
            </button>
          ))}
        </div>
        <div className="type-spacer" />
        <button
          type="button"
          className={`title-language-toggle ${showChineseTitle ? 'active' : ''}`}
          role="switch"
          aria-checked={showChineseTitle}
          onClick={onToggleTitleLanguage}
          title={showChineseTitle ? '当前显示中文译名，点击切换为原名' : '当前显示原名，点击切换为中文译名'}
        >
          <span className="title-language-label">中文名</span>
          <span className="title-language-track">
            <span className="title-language-thumb" />
          </span>
        </button>
      </div>

      {/* 二级状态筛选：文案随条目类型动态切换（在看/在读/在玩 等） */}
      <div className="filter-bar">
        {COLLECTION_STATUS_VALUES.map(value => (
          <button
            key={value}
            className={`filter-chip ${selectedFilter === value ? 'active' : ''}`}
            onClick={() => onSelectFilter(value)}
          >
            {getCollectionStatusLabel(value, selectedSubjectType)}
          </button>
        ))}
        <div className="filter-spacer" />
        <button
          className={`filter-refresh-btn ${scheduleUnavailable ? 'degraded' : ''}`}
          onClick={onRefreshCollections}
          title={scheduleUnavailable ? '刷新（放送表未加载，更新状态暂按日期判断）' : '刷新'}
        >↻</button>
        <span className="filter-count">{searchQuery.trim() ? `${searchResults.length}条` : `${filteredCollections.length}部`}</span>
      </div>

      <div className="content">
        {isLoading && <div className="loading"><div className="spinner" /></div>}
        {!isLoading && error && <div className="empty-state"><div className="empty-title">{error}</div></div>}

        {!isLoading && !error && showNotifications && notifications.length > 0 && (
          <div className="notif-panel">
            <div className="notif-panel-header">
              <span>通知 ({notifications.length})</span>
              <button className="notif-clear" onClick={clearNotifications}>清空</button>
            </div>
            <div className="notif-list">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notif-item ${notification.type}`}
                  onClick={() => {
                    if (notification.subjectId) onOpenSubject(notification.subjectId)
                    onToggleNotifications(() => false)
                  }}
                >
                  <div className="notif-item-title">
                    {notification.type === 'rating' ? '★' : '▶'} {notification.subjectName}
                  </div>
                  <div className="notif-item-text">{notification.text}</div>
                  <div className="notif-item-time">{formatTime(notification.time)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && searchQuery.trim() && searchResults.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">没有找到"{searchQuery}"</div>
            <div className="empty-hint">试试其他关键词</div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && searchQuery.trim() && searchResults.length > 0 && (
          <>
            <div className="search-results-hint">在{doingLabel}+{wishLabel}中找到 {searchResults.length} 个结果</div>
            {searchResults.map((item, index) => (
              <AnimeCard
                key={getSubjectId(item) || index}
                item={item}
                index={index}
                expandedCard={expandedCard}
                isLoggedIn={true}
                selectedFilter={selectedFilter}
                showChineseTitle={showChineseTitle}
                onToggleCard={onToggleCard}
                onMarkEpisode={onMarkEpisode}
                onMarkEpisodesUpTo={onMarkEpisodesUpTo}
                onOpenSubject={onOpenSubject}
                onShowEpisodeMenu={onShowEpisodeMenu}
                setHoveredEp={setHoveredEp}
                onUnwatchedUpdate={onUnwatchedUpdate}
                unwatchedCounts={unwatchedCounts}
                scheduleMap={scheduleMap}
                onEditStatus={onEditStatus}
                subjectType={selectedSubjectType}
              />
            ))}
          </>
        )}

        {!isLoading && !error && !showNotifications && !searchQuery.trim() && filteredCollections.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">暂无内容</div>
            <div className="empty-hint">去 Bangumi 添加一些{activeTypeLabel}吧</div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && !searchQuery.trim() && sortedCollections.map((item, index) => (
          <AnimeCard
            key={getSubjectId(item) || index}
            item={item}
            index={index}
            expandedCard={expandedCard}
            isLoggedIn={true}
            selectedFilter={selectedFilter}
            showChineseTitle={showChineseTitle}
            onToggleCard={onToggleCard}
            onMarkEpisode={onMarkEpisode}
            onMarkEpisodesUpTo={onMarkEpisodesUpTo}
            onOpenSubject={onOpenSubject}
            onShowEpisodeMenu={onShowEpisodeMenu}
            setHoveredEp={setHoveredEp}
            onUnwatchedUpdate={onUnwatchedUpdate}
            unwatchedCounts={unwatchedCounts}
            scheduleMap={scheduleMap}
            onEditStatus={onEditStatus}
            subjectType={selectedSubjectType}
          />
        ))}
      </div>

      <div className="footer"><span>BangumiBar</span></div>

      {toast && <div className="toast">{toast}</div>}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseLeave={onCloseContextMenu}>
          <div className="context-menu-item" onClick={() => { contextMenu.onSelect(2); onCloseContextMenu() }}>
            <span className="menu-dot watched" /> 标记看过
          </div>
          <div className="context-menu-item" onClick={() => { contextMenu.onWatchUpTo(); onCloseContextMenu() }}>
            <span className="menu-dot batch" /> 看到第{contextMenu.episodeNumber}集
          </div>
          <div className="context-menu-item" onClick={() => { contextMenu.onSelect(0); onCloseContextMenu() }}>
            <span className="menu-dot unwatched" /> 取消看过
          </div>
        </div>
      )}

      {hoveredEp && (
        <div className="ep-tooltip" style={{ left: hoveredEp.x, top: hoveredEp.y }} onMouseEnter={() => setHoveredEp(hoveredEp)}>
          <div className="ep-tooltip-title">第{hoveredEp.ep.epNum}集</div>
          {hoveredEp.ep.epName && <div className="ep-tooltip-name">{hoveredEp.ep.epName}</div>}
          {hoveredEp.ep.epAirdate && <div className="ep-tooltip-date">播出: {hoveredEp.ep.epAirdate}</div>}
          <div className="ep-tooltip-status">{hoveredEp.ep.isWatched ? '已看' : '未看'}</div>
        </div>
      )}

      {statusEditItem && (
        <StatusEditModal
          subject={statusEditItem.subject}
          subjectType={statusEditItem.subjectType}
          currentType={statusEditItem.collectionItem?.type}
          currentRating={getUserRating(statusEditItem.collectionItem)}
          currentComment={statusEditItem.collectionItem?.comment || ''}
          onClose={onCloseStatusEdit}
          onSubmit={onSubmitStatusEdit}
        />
      )}
    </div>
  )
}
