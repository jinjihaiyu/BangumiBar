import { AnimeCard } from '../components/AnimeCard'
import { RatingModal } from '../components/RatingModal'
import { StatusEditModal } from '../components/StatusEditModal'
import { formatTime } from '../utils'

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
  subjectTypes: SubjectTypeOption[]
  searchResults: any[]
  filteredCollections: any[]
  sortedCollections: any[]
  isLoading: boolean
  error: string | null
  expandedCard: number | null
  selectedEpisodes: Set<number>
  unwatchedCounts: Record<number, number>
  contextMenu: { x: number; y: number; subjectId: number; episodeId: number } | null
  hoveredEp: { x: number; y: number; ep: any } | null
  pendingRating: any
  statusEditItem: { subject: any; subjectType: number; collectionItem: any } | null
  toast: string | null
  onOpenSettings: () => void
  onToggleNotifications: (updater: (current: boolean) => boolean) => void
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onSelectFilter: (value: number) => void
  onRefreshCollections: () => void
  onSelectSubjectType: (value: number) => void
  onToggleCard: (event: React.MouseEvent, item: any) => void
  onMarkEpisode: (subjectId: number, episodeId: number, newType: number) => void
  onBatchMark: (subjectId: number, episodeIds: number[], newType: number) => void
  onOpenSubject: (subjectId: number) => void
  onShowEpisodeMenu: (event: React.MouseEvent, subjectId: number, episodeId: number) => void
  getSelectedEpisodeIds: (subjectId: number) => number[]
  setSelectedEpisodes: React.Dispatch<React.SetStateAction<Set<number>>>
  setHoveredEp: React.Dispatch<React.SetStateAction<{ x: number; y: number; ep: any } | null>>
  onRequestRating: (subject: any) => void
  onUnwatchedUpdate: (subjectId: number, count: number) => void
  onEditStatus: (subject: any, subjectType: number, collectionItem: any) => void
  clearNotifications: () => void
  onCloseContextMenu: () => void
  onCloseRating: () => void
  onSubmitRating: (rating: number, comment: string) => Promise<void> | void
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
  subjectTypes,
  searchResults,
  filteredCollections,
  sortedCollections,
  isLoading,
  error,
  expandedCard,
  selectedEpisodes,
  unwatchedCounts,
  contextMenu,
  hoveredEp,
  pendingRating,
  statusEditItem,
  toast,
  onOpenSettings,
  onToggleNotifications,
  onSearchChange,
  onClearSearch,
  onSelectFilter,
  onRefreshCollections,
  onSelectSubjectType,
  onToggleCard,
  onMarkEpisode,
  onBatchMark,
  onOpenSubject,
  onShowEpisodeMenu,
  getSelectedEpisodeIds,
  setSelectedEpisodes,
  setHoveredEp,
  onRequestRating,
  onUnwatchedUpdate,
  onEditStatus,
  clearNotifications,
  onCloseContextMenu,
  onCloseRating,
  onSubmitRating,
  onCloseStatusEdit,
  onSubmitStatusEdit,
}: MainPageProps) {
  // 页面层只负责展示与事件转发，业务状态仍由 hooks 管理。
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
          <button className="header-btn" onClick={onOpenSettings}>⚙</button>
        </div>
      </div>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input type="text" className="search-input" placeholder="搜索番剧..." value={searchQuery} onChange={event => onSearchChange(event.target.value)} />
        {searchQuery && <button className="search-clear" onClick={onClearSearch}>✕</button>}
      </div>

      <div className="filter-bar">
        {[{ value: 3, label: '在看' }, { value: 1, label: '想看' }].map(filter => (
          <button
            key={filter.value}
            className={`filter-chip ${selectedFilter === filter.value ? 'active' : ''}`}
            onClick={() => onSelectFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
        <div className="filter-spacer" />
        <button className="filter-refresh-btn" onClick={onRefreshCollections} title="刷新">↻</button>
        <span className="filter-count">{searchQuery.trim() ? `${searchResults.length}条结果` : `${filteredCollections.length}部`}</span>
      </div>

      <div className="type-bar">
        {subjectTypes.map(subjectType => (
          <button
            key={subjectType.value}
            className={`type-chip ${selectedSubjectType === subjectType.value ? 'active' : ''}`}
            onClick={() => onSelectSubjectType(subjectType.value)}
          >
            <span className="type-icon">{subjectType.icon}</span>
            <span className="type-label">{subjectType.label}</span>
          </button>
        ))}
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
                    {notification.type === 'rating' ? '⭐' : '▶'} {notification.subjectName}
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
            <div className="empty-icon">🔍</div>
            <div className="empty-title">没有找到"{searchQuery}"</div>
            <div className="empty-hint">试试其他关键词</div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && searchQuery.trim() && searchResults.length > 0 && (
          <>
            <div className="search-results-hint">在在看+想看中找到 {searchResults.length} 个结果</div>
            {searchResults.map((item, index) => (
              <AnimeCard
                key={(item.subjectId || item.subject?.id || item.subject_id) || index}
                item={item}
                index={index}
                expandedCard={expandedCard}
                selectedEpisodes={selectedEpisodes}
                isLoggedIn={true}
                selectedFilter={selectedFilter}
                onToggleCard={onToggleCard}
                onMarkEpisode={onMarkEpisode}
                onBatchMark={onBatchMark}
                onOpenSubject={onOpenSubject}
                onShowEpisodeMenu={onShowEpisodeMenu}
                getSelectedEpisodeIds={getSelectedEpisodeIds}
                setSelectedEpisodes={setSelectedEpisodes}
                setHoveredEp={setHoveredEp}
                onRequestRating={onRequestRating}
                onUnwatchedUpdate={onUnwatchedUpdate}
                unwatchedCounts={unwatchedCounts}
                onEditStatus={onEditStatus}
                subjectType={selectedSubjectType}
              />
            ))}
          </>
        )}

        {!isLoading && !error && !showNotifications && !searchQuery.trim() && filteredCollections.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📺</div>
            <div className="empty-title">暂无内容</div>
            <div className="empty-hint">去 Bangumi 添加一些番剧吧</div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && !searchQuery.trim() && sortedCollections.map((item, index) => (
          <AnimeCard
            key={(item.subjectId || item.subject?.id || item.subject_id) || index}
            item={item}
            index={index}
            expandedCard={expandedCard}
            selectedEpisodes={selectedEpisodes}
            isLoggedIn={true}
            selectedFilter={selectedFilter}
            onToggleCard={onToggleCard}
            onMarkEpisode={onMarkEpisode}
            onBatchMark={onBatchMark}
            onOpenSubject={onOpenSubject}
            onShowEpisodeMenu={onShowEpisodeMenu}
            getSelectedEpisodeIds={getSelectedEpisodeIds}
            setSelectedEpisodes={setSelectedEpisodes}
            setHoveredEp={setHoveredEp}
            onRequestRating={onRequestRating}
            onUnwatchedUpdate={onUnwatchedUpdate}
            unwatchedCounts={unwatchedCounts}
            onEditStatus={onEditStatus}
            subjectType={selectedSubjectType}
          />
        ))}
      </div>

      <div className="footer"><span>BangumiBar</span></div>

      {toast && <div className="toast">{toast}</div>}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseLeave={onCloseContextMenu}>
          <div className="context-menu-item" onClick={() => { onMarkEpisode(contextMenu.subjectId, contextMenu.episodeId, 2); onCloseContextMenu() }}>
            <span className="menu-dot watched" /> 标记看过
          </div>
          <div className="context-menu-item" onClick={() => { onMarkEpisode(contextMenu.subjectId, contextMenu.episodeId, 0); onCloseContextMenu() }}>
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

      {pendingRating && (
        <RatingModal subject={pendingRating} onClose={onCloseRating} onSubmit={onSubmitRating} />
      )}

      {statusEditItem && (
        <StatusEditModal
          subject={statusEditItem.subject}
          subjectType={statusEditItem.subjectType}
          currentType={statusEditItem.collectionItem?.type}
          currentRating={statusEditItem.collectionItem?.rating ?? 0}
          currentComment={statusEditItem.collectionItem?.comment || ''}
          onClose={onCloseStatusEdit}
          onSubmit={onSubmitStatusEdit}
        />
      )}
    </div>
  )
}
