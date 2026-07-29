'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react'
import {
  fetchCommunityDocuments,
  saveCommunityDocument,
  unsaveCommunityDocument,
} from '../api/community.api'
import { useLanguage } from '../i18n/LanguageProvider'
import { localizeCommunityDocument } from '../i18n/document-display'
import { localize } from '../i18n/localize'
import { ApiError } from '../lib/http'
import type { CommunityDocument } from '../types/community'

export function CommunityView() {
  const { locale } = useLanguage()
  const text = useCallback((vi: string, en: string) => localize(locale, vi, en), [locale])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [documents, setDocuments] = useState<CommunityDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [savingIds, setSavingIds] = useState<string[]>([])
  const displayedDocuments = useMemo(
    () => documents.map((item) => localizeCommunityDocument(item, locale)),
    [documents, locale],
  )
  const categories = useMemo(
    () => ['All', ...new Set(displayedDocuments.map((item) => item.category))],
    [displayedDocuments],
  )
  const savingIdSet = useMemo(() => new Set(savingIds), [savingIds])

  useEffect(() => {
    setCategory('All')
  }, [locale, text])

  useEffect(() => {
    let isMounted = true

    async function loadDocuments() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const result = await fetchCommunityDocuments({ limit: 100 })
        if (isMounted) setDocuments(result.items)
      } catch (error) {
        if (!isMounted) return
        const message =
          error instanceof ApiError
            ? error.message
            : text('Không thể tải tài liệu cộng đồng.', 'Unable to load community documents.')
        setErrorMessage(message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadDocuments()

    return () => {
      isMounted = false
    }
  }, [text])

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return displayedDocuments.filter((document) => {
      const categoryMatches = category === 'All' || document.category === category
      const queryMatches =
        !normalized ||
        [document.title, document.description, document.subject, document.category].some(
          (value) => value.toLowerCase().includes(normalized),
        )
      return categoryMatches && queryMatches
    })
  }, [category, displayedDocuments, query])

  function formatUpdatedAt(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')
  }

  async function toggleSaved(document: CommunityDocument) {
    if (document.owned || savingIdSet.has(document.id)) return

    setSavingIds((current) => [...current, document.id])
    setDocuments((current) =>
      current.map((item) =>
        item.id === document.id
          ? {
              ...item,
              saved: !item.saved,
              savedCount: Math.max(0, item.savedCount + (item.saved ? -1 : 1)),
            }
          : item,
      ),
    )

    try {
      if (document.saved) {
        await unsaveCommunityDocument(document.id)
      } else {
        await saveCommunityDocument(document.id)
      }
    } catch (error) {
      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id
            ? {
                ...item,
                saved: document.saved,
                savedCount: document.savedCount,
              }
            : item,
        ),
      )
      const message =
        error instanceof ApiError
          ? error.message
          : text('Không thể cập nhật trạng thái lưu.', 'Unable to update saved status.')
      setErrorMessage(message)
    } finally {
      setSavingIds((current) => current.filter((id) => id !== document.id))
    }
  }

  return (
    <main id="main-content" className="community-page">
      <header className="community-heading">
        <p className="eyebrow">{text('THƯ VIỆN CỘNG ĐỒNG', 'COMMUNITY LIBRARY')}</p>
        <h1>{text('Kiến thức hữu ích từ cộng đồng.', 'Useful knowledge from the community.')}</h1>
        <p>
          {text(
            'Khám phá tài liệu học tập công khai, xem trọng tâm học thuật và lưu những nguồn phù hợp nhất vào thư viện của bạn.',
            'Discover public study materials, inspect their academic focus, and save the strongest sources into your own library.',
          )}
        </p>
      </header>

      <section className="community-search-band">
        <div className="community-search">
          <Sparkles size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text('Nhờ AI tìm tài liệu học tập công khai hữu ích...', 'Ask AI to find useful public study materials...')}
          />
          <button type="button" aria-label={text('Tìm kiếm trong cộng đồng', 'Search community')}>
            <Search size={18} />
          </button>
        </div>
        <div className="category-tabs" role="tablist" aria-label={text('Danh mục tài liệu', 'Document categories')}>
          {categories.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={category === item}
              className={category === item ? 'active' : undefined}
              key={item}
              onClick={() => setCategory(item)}
            >
              {item === 'All' ? text('Tất cả', 'All') : item}
            </button>
          ))}
        </div>
      </section>

      <div className="community-results-heading">
        <div>
          <strong>{filteredDocuments.length} {text('tài liệu công khai', 'public documents')}</strong>
          <span>{text('Được tuyển chọn bởi cộng đồng học tập DocuMind', 'Curated by the DocuMind learning community')}</span>
        </div>
        <span className="ai-summary-badge">
          <Sparkles size={14} />
          {text('Có bản tóm tắt bằng AI', 'AI summaries available')}
        </span>
      </div>

      {errorMessage && documents.length === 0 ? (
        <div className="soft-empty-state community-empty">
          <Search size={30} />
          <strong>{errorMessage}</strong>
          <p>{text('Vui lòng thử lại sau ít phút.', 'Please try again in a moment.')}</p>
        </div>
      ) : isLoading ? (
        <div className="soft-empty-state community-empty">
          <Sparkles size={30} />
          <strong>{text('Đang tải tài liệu cộng đồng...', 'Loading community documents...')}</strong>
        </div>
      ) : filteredDocuments.length > 0 ? (
        <section className="community-grid">
          {filteredDocuments.map((document) => {
            const isSaved = Boolean(document.saved)
            const isOwned = Boolean(document.owned)
            const isSaving = savingIdSet.has(document.id)
            return (
              <article className="community-card" key={document.id}>
                <div className={`community-cover community-cover--${document.accent}`}>
                  <span>{document.fileType}</span>
                  <strong>{document.subject}</strong>
                  <small>{document.pages > 0 ? `${document.pages} ${text('trang', 'pages')}` : document.fileSize}</small>
                </div>
                <div className="community-card-body">
                  <div className="community-card-meta">
                    <span>{document.category}</span>
                    <span>{formatUpdatedAt(document.updatedAt)}</span>
                  </div>
                  <h2>{document.title}</h2>
                  <p>{document.description}</p>
                  <div className="community-owner">
                    <span className="owner-avatar">
                      <UserRound size={15} />
                    </span>
                    <span>
                      <strong>{document.owner}</strong>
                      <small>{document.savedCount} {text('lượt lưu', 'saves')}</small>
                    </span>
                  </div>
                  {!isOwned ? (
                  <button
                    type="button"
                    className={isSaved ? 'save-library-button saved' : 'save-library-button'}
                    onClick={() => void toggleSaved(document)}
                    disabled={isSaving}
                  >
                    {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                    {isSaved
                      ? text('Đã lưu vào thư viện', 'Saved to My Library')
                      : text('Lưu vào thư viện', 'Save to My Library')}
                  </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <div className="soft-empty-state community-empty">
          <Search size={30} />
          <strong>{text('Không có tài liệu công khai phù hợp', 'No public documents match this search')}</strong>
          <p>{text('Thử chủ đề rộng hơn hoặc chuyển sang danh mục khác.', 'Try a broader topic or switch to another category.')}</p>
        </div>
      )}
    </main>
  )
}
