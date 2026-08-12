import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { pageApi, type PageDTO } from '../services/api';
import AdminIcon from '../components/admin/AdminIcon';


type PageStatus = 'published' | 'draft' | 'private';

interface PageRecord {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: PageStatus;
  order: number;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

interface PageFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: PageStatus;
  order: number;
  seoTitle: string;
  seoDescription: string;
}

const STORAGE_KEY = 'pages';

const PAGE_STATUS_OPTIONS: Array<{ value: PageStatus; label: string; description: string }> = [
  { value: 'published', label: 'Đã xuất ban', description: 'Trang hiển thị công khai cho khách hàng.' },
  { value: 'draft', label: 'Bản nháp', description: 'Mới lưu nội bộ, chưa công khai.' },
  { value: 'private', label: 'Riêng tư', description: 'Chỉ để nội bộ, không hiển thị công khai.' },
];

const CONTENT_BLOCKS = [
  {
    label: 'Tiêu đề',
    snippet: '<h2>Tiêu đề mục</h2>\n<p>Mô tả ngắn cho mục nội dung này.</p>',
  },
  {
    label: 'Đoạn van',
    snippet: '<p>Nhập nội dung chi tiết của trang tại đây.</p>',
  },
  {
    label: 'Danh sách',
    snippet: '<ul>\n  <li>Y đầu tiên</li>\n  <li>Y thu hai</li>\n  <li>Y thu ba</li>\n</ul>',
  },
  {
    label: 'Thông điệp',
    snippet: '<blockquote>Thông điệp nổi bật mà bạn muốn nhấn mạnh.</blockquote>',
  },
  {
    label: 'Nut CTA',
    snippet: '<p><a href="/products" class="page-cta">Mua ngay</a></p>',
  },
];

const DEFAULT_FORM: PageFormState = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  status: 'draft',
  order: 1,
  seoTitle: '',
  seoDescription: '',
};

function slugify(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPagePreview(content: string): string {
  const trimmed = content.trim();

  if (!trimmed) {
    return '<p>Chưa có nội dung để preview.</p>';
  }

  const containsHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);

  if (containsHtml) {
    return trimmed;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function normalizePage(rawPage: Partial<PageRecord>, fallbackId: number): PageRecord {
  const title = typeof rawPage.title === 'string' ? rawPage.title.trim() : '';
  const content = typeof rawPage.content === 'string' ? rawPage.content : '';
  const fallbackExcerpt = stripHtmlTags(content).slice(0, 140);
  const normalizedStatus = rawPage.status === 'published' || rawPage.status === 'private' ? rawPage.status : 'draft';

  return {
    id: Number(rawPage.id) || fallbackId,
    title,
    slug: typeof rawPage.slug === 'string' ? rawPage.slug.trim() : '',
    excerpt: typeof rawPage.excerpt === 'string' ? rawPage.excerpt.trim() : fallbackExcerpt,
    content,
    status: normalizedStatus,
    order: Number.isFinite(Number(rawPage.order)) ? Number(rawPage.order) : 1,
    seoTitle: typeof rawPage.seoTitle === 'string' ? rawPage.seoTitle.trim() : title,
    seoDescription: typeof rawPage.seoDescription === 'string' ? rawPage.seoDescription.trim() : fallbackExcerpt,
    createdAt: typeof rawPage.createdAt === 'string' ? rawPage.createdAt : new Date().toISOString(),
    updatedAt: typeof rawPage.updatedAt === 'string' ? rawPage.updatedAt : typeof rawPage.createdAt === 'string' ? rawPage.createdAt : new Date().toISOString(),
    publishedAt: typeof rawPage.publishedAt === 'string' ? rawPage.publishedAt : normalizedStatus === 'published' ? new Date().toISOString() : undefined,
  };
}

function readStoredPages(): PageRecord[] {
  return [];
}

function saveStoredPages(pages: PageRecord[]): PageRecord[] {
  return pages;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AdminPages() {
  const { confirm } = useAdminUi();
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PageStatus>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [previewPageId, setPreviewPageId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PageFormState>(DEFAULT_FORM);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const loadPages = async () => {
      const result = await pageApi.getAll();
      if (result.success && result.data) {
        const mapped: PageRecord[] = result.data.map((dto: PageDTO) => normalizePage({
          id: dto.id,
          title: dto.tieuDe || '',
          slug: dto.slug || '',
          content: dto.noiDung || '',
          status: (dto.trangThai || 'draft') as PageStatus,
          seoTitle: dto.metaTitle || '',
          seoDescription: dto.metaDescription || '',
          createdAt: dto.ngayTao,
          updatedAt: dto.ngayCapNhat || dto.ngayTao,
        }, dto.id));
        setPages(mapped);
      }
    };
    void loadPages();
  }, []);

  const orderedPages = useMemo(() => (
    [...pages].sort((left, right) => left.order - right.order || right.id - left.id)
  ), [pages]);

  const filteredPages = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

    return orderedPages.filter((page) => {
      const matchesSearch = !normalizedSearch
        || page.title.toLocaleLowerCase().includes(normalizedSearch)
        || page.slug.toLocaleLowerCase().includes(normalizedSearch)
        || page.excerpt.toLocaleLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || page.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orderedPages, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: pages.length,
    published: pages.filter((page) => page.status === 'published').length,
    draft: pages.filter((page) => page.status === 'draft').length,
    private: pages.filter((page) => page.status === 'private').length,
  }), [pages]);

  const editorPreviewHtml = useMemo(() => renderPagePreview(form.content), [form.content]);
  const previewPage = previewPageId ? pages.find((page) => page.id === previewPageId) || null : null;

  const persistPages = (nextPages: PageRecord[], message: string) => {
    setPages(nextPages);
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 3000);
  };

  const openCreateEditor = () => {
    setEditId(null);
    setError('');
    setForm(DEFAULT_FORM);
    setShowEditor(true);
  };

  const openEditEditor = (page: PageRecord) => {
    setEditId(page.id);
    setError('');
    setForm({
      title: page.title,
      slug: page.slug,
      excerpt: page.excerpt,
      content: page.content,
      status: page.status,
      order: page.order,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
    });
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditId(null);
    setError('');
    setForm(DEFAULT_FORM);
  };

  const handleSavePage = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setError('Cần nhập tiêu đề, slug và nội dung trang.');
      return;
    }

    const now = new Date().toISOString();
    const normalizedSlug = slugify(form.slug);
    const duplicatePage = pages.find((page) => page.slug === normalizedSlug && page.id !== editId);

    if (duplicatePage) {
      setError('Slug này da được sử dụng. Vui lòng đổi slug khác.');
      return;
    }

    const basePage: PageRecord = normalizePage({
      id: editId || Date.now(),
      title: form.title,
      slug: normalizedSlug,
      excerpt: form.excerpt || stripHtmlTags(form.content).slice(0, 140),
      content: form.content,
      status: form.status,
      order: form.order,
      seoTitle: form.seoTitle || form.title,
      seoDescription: form.seoDescription || form.excerpt || stripHtmlTags(form.content).slice(0, 160),
      createdAt: editId ? pages.find((page) => page.id === editId)?.createdAt : now,
      updatedAt: now,
      publishedAt: form.status === 'published'
        ? pages.find((page) => page.id === editId)?.publishedAt || now
        : undefined,
    }, editId || Date.now());

    const payload = {
      tieuDe: form.title.trim(),
      slug: normalizedSlug,
      noiDung: form.content,
      trangThai: form.status,
      metaTitle: form.seoTitle || form.title,
      metaDescription: form.seoDescription || form.excerpt || stripHtmlTags(form.content).slice(0, 160),
    };

    try {
      if (editId) {
        await pageApi.update(editId, payload);
        persistPages(pages.map((page) => (page.id === editId ? basePage : page)), 'Đã cập nhật trang nội dung.');
      } else {
        const result = await pageApi.create(payload);
        if (result.success && result.data) {
          basePage.id = result.data.id;
        }
        persistPages([...pages, basePage], 'Đã tạo trang nội dung mới.');
      }
    } catch {
      setError('Lỗi kết nối server.');
      return;
    }
    closeEditor();
  };

  const handleDeletePage = async (pageId: number) => {
    const selectedPage = pages.find((page) => page.id === pageId);

    if (!selectedPage) {
      return;
    }

    const accepted = await confirm({
      title: 'Xóa trang nội dung',
      message: `Trang "${selectedPage.title}" sẽ bị xóa khỏi kho nội dung.`,
      confirmLabel: 'Xóa trang',
      tone: 'danger',
      icon: 'fa-file-circle-xmark',
    });

    if (!accepted) {
      return;
    }

    const result = await pageApi.delete(pageId);
    if (result.success) {
      persistPages(
        pages.filter((page) => page.id !== pageId),
        'Đã xóa trang nội dung.',
      );
    }
  };

  const insertContentBlock = (snippet: string) => {
    const textarea = contentRef.current;

    if (!textarea) {
      setForm((current) => ({
        ...current,
        content: current.content ? `${current.content}\n\n${snippet}` : snippet,
      }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextContent = `${form.content.slice(0, start)}${snippet}${form.content.slice(end)}`;

    setForm((current) => ({
      ...current,
      content: nextContent,
    }));

    requestAnimationFrame(() => {
      textarea.focus();
      const caretPosition = start + snippet.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  };

  return (
    <div className="pages-admin-page">
      <div className="page-header">
        <div>
          <h1>Quản lý Trang nội dung</h1>
          <p className="pages-admin-subtitle">Thêm, chỉnh sửa và preview trang nội dung với trạng thái xuất bản rõ ràng.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreateEditor}>
            <AdminIcon name="fa fa-plus" /> Thêm trang
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="alert alert-success pages-admin-feedback">
          <AdminIcon name="fa fa-check-circle" /> {feedback}
        </div>
      ) : null}

      <div className="stats-grid-small">
        <div className="stat-card-small">
          <div className="stat-icon-small pages-stat-icon-total">
            <AdminIcon name="fa fa-file-alt" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Tong trang</span>
            <h3 className="stat-value-small">{stats.total}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small completed">
            <AdminIcon name="fa fa-globe" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Đã xuất ban</span>
            <h3 className="stat-value-small">{stats.published}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small pending">
            <AdminIcon name="fa fa-pen" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Bản nháp</span>
            <h3 className="stat-value-small">{stats.draft}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small pages-stat-icon-private">
            <AdminIcon name="fa fa-lock" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Riêng tư</span>
            <h3 className="stat-value-small">{stats.private}</h3>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="filters-bar pages-admin-filters">
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tim theo tiêu đề, slug, tóm tắt..."
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | PageStatus)}
          >
            <option value="all">Tất cả trạng thái</option>
            {PAGE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trang</th>
                <th className="pages-col-status">Trạng thái</th>
                <th className="pages-col-order">Thứ tự</th>
                <th className="pages-col-updated">Cập nhật</th>
                <th className="pages-col-actions">Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="loading-row">Chưa có trang nào phù hợp bộ lọc.</td>
                </tr>
              ) : (
                filteredPages.map((page) => {
                  const currentStatus = PAGE_STATUS_OPTIONS.find((option) => option.value === page.status);

                  return (
                    <tr key={page.id}>
                      <td>
                        <div className="pages-admin-cell">
                          <strong>{page.title}</strong>
                          <span>/{page.slug}</span>
                          <p>{page.excerpt || stripHtmlTags(page.content).slice(0, 140)}</p>
                        </div>
                      </td>
                      <td>
                        <div className={`pages-status-badge ${page.status}`}>
                          <strong>{currentStatus?.label}</strong>
                          <span>{currentStatus?.description}</span>
                        </div>
                      </td>
                      <td>{page.order}</td>
                      <td>
                        <div className="pages-admin-date">
                          <strong>{formatDateTime(page.updatedAt)}</strong>
                          <span>Công khai: {formatDateTime(page.publishedAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-action view" onClick={() => setPreviewPageId(page.id)} title="Preview">
                            <AdminIcon name="fa fa-eye" />
                          </button>
                          <button className="btn-action btn-edit" onClick={() => openEditEditor(page)} title="Chỉnh sửa">
                            <AdminIcon name="fa fa-pen" />
                          </button>
                          <button className="btn-action btn-delete" onClick={() => handleDeletePage(page.id)} title="Xóa">
                            <AdminIcon name="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditor ? (
        <div className="modal active" onClick={closeEditor}>
          <div className="modal-dialog modal-xl pages-editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>{editId ? 'Chỉnh sửa trang nội dung' : 'Thêm trang mới'}</h3>
                <button className="modal-close" onClick={closeEditor}>
                  <AdminIcon name="fa fa-times" />
                </button>
              </div>

              <div className="modal-body pages-editor-body">
                <div className="pages-editor-form">
                  {error ? (
                    <div className="alert alert-danger">
                      <AdminIcon name="fa fa-circle-exclamation" /> {error}
                    </div>
                  ) : null}

                  <div className="form-group">
                    <label className="form-label required">Tiêu đề trang</label>
                    <input
                      className="form-control"
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                          slug: current.slug ? current.slug : slugify(event.target.value),
                        }))
                      }
                      placeholder="Ví dụ: Ve chung toi"
                    />
                  </div>

                  <div className="pages-form-grid">
                    <div className="form-group">
                      <label className="form-label required">Slug</label>
                      <div className="pages-inline-control">
                        <input
                          className="form-control"
                          value={form.slug}
                          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                          placeholder="ve-chung-toi"
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setForm((current) => ({ ...current, slug: slugify(current.title) }))}
                        >
                          Tạo tự động
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Thứ tự hiển thị</label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={form.order}
                        onChange={(event) => setForm((current) => ({ ...current, order: Number(event.target.value) || 1 }))}
                      />
                    </div>
                  </div>

                  <div className="pages-form-grid">
                    <div className="form-group">
                      <label className="form-label">Trạng thái xuất bản</label>
                      <select
                        className="form-control"
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PageStatus }))}
                      >
                        {PAGE_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tóm tắt ngắn</label>
                      <input
                        className="form-control"
                        value={form.excerpt}
                        onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
                        placeholder="Đoạn giới thiệu ngắn hiện trong bảng quản trị."
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="pages-toolbar-header">
                      <label className="form-label required">Nội dung trang</label>
                      <div className="pages-content-toolbar">
                        {CONTENT_BLOCKS.map((block) => (
                          <button
                            key={block.label}
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => insertContentBlock(block.snippet)}
                          >
                            {block.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      ref={contentRef}
                      className="form-control pages-content-editor"
                      rows={18}
                      value={form.content}
                      onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                      placeholder="Nhập HTML đơn giản hoặc nội dung text. Preview bên phải sẽ cập nhật theo thời gian thực."
                    />
                  </div>

                  <div className="pages-form-grid">
                    <div className="form-group">
                      <label className="form-label">SEO title</label>
                      <input
                        className="form-control"
                        value={form.seoTitle}
                        onChange={(event) => setForm((current) => ({ ...current, seoTitle: event.target.value }))}
                        placeholder="Mặc định sẽ lấy theo tiêu đề trang"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">SEO description</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.seoDescription}
                        onChange={(event) => setForm((current) => ({ ...current, seoDescription: event.target.value }))}
                        placeholder="Mô tả ngắn dùng cho tìm kiếm."
                      />
                    </div>
                  </div>
                </div>

                <aside className="pages-preview-panel">
                  <div className="pages-preview-card">
                    <div className="pages-preview-meta">
                      <span>Preview</span>
                      <strong>/{slugify(form.slug || form.title || 'trang-mới')}</strong>
                    </div>
                    <h2>{form.title || 'Tiêu đề trang sẽ hiện ở đây'}</h2>
                    <p className="pages-preview-excerpt">{form.excerpt || 'Tóm tắt ngắn sẽ hiển thị tại đây để admin kiểm tra bố cục.'}</p>
                    <div
                      className="pages-preview-content"
                      dangerouslySetInnerHTML={{ __html: editorPreviewHtml }}
                    />
                  </div>

                  <div className="pages-preview-card pages-seo-card">
                    <h4>SEO nhanh</h4>
                    <p><strong>Title:</strong> {form.seoTitle || form.title || '--'}</p>
                    <p><strong>Description:</strong> {form.seoDescription || form.excerpt || '--'}</p>
                    <p><strong>Trạng thái:</strong> {PAGE_STATUS_OPTIONS.find((option) => option.value === form.status)?.description}</p>
                  </div>
                </aside>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={closeEditor}>Động</button>
                <button className="btn btn-primary" onClick={handleSavePage}>
                  <AdminIcon name="fa fa-save" /> Lưu trang
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewPage ? (
        <div className="modal active" onClick={() => setPreviewPageId(null)}>
          <div className="modal-dialog modal-lg pages-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Preview: {previewPage.title}</h3>
                <button className="modal-close" onClick={() => setPreviewPageId(null)}>
                  <AdminIcon name="fa fa-times" />
                </button>
              </div>
              <div className="modal-body">
                <div className="pages-preview-card pages-preview-card-full">
                  <div className="pages-preview-meta">
                    <span>/{previewPage.slug}</span>
                    <strong>{PAGE_STATUS_OPTIONS.find((option) => option.value === previewPage.status)?.label}</strong>
                  </div>
                  <h2>{previewPage.title}</h2>
                  <p className="pages-preview-excerpt">{previewPage.excerpt}</p>
                  <div
                    className="pages-preview-content"
                    dangerouslySetInnerHTML={{ __html: renderPagePreview(previewPage.content) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
