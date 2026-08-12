import { useEffect, useMemo, useState } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { bannerApi, type BannerDTO } from '../services/api';
import {
  createBannerDefaults,
  normalizeBannerItem,
  type BannerItem,
  type BannerType,
} from '../utils/bannerConfig';
import AdminIcon from '../components/admin/AdminIcon';


type BannerFormState = Omit<BannerItem, 'id'>;

function formatOrderLabel(order: number) {
  return `#${String(order).padStart(2, '0')}`;
}

function buildOrderedList(
  banners: BannerItem[],
  type: BannerType,
  orderedIds: number[],
): BannerItem[] {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]));

  return banners.map((banner) =>
    banner.type === type && orderMap.has(banner.id)
      ? normalizeBannerItem(
          {
            ...banner,
            order: orderMap.get(banner.id),
          },
          type,
          orderMap.get(banner.id),
        )
      : banner,
  );
}

export default function AdminBanners() {
  const { confirm, notify } = useAdminUi();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activeTab, setActiveTab] = useState<BannerType>('slider');
  const [showForm, setShowForm] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<BannerFormState>(createBannerDefaults('slider'));

  useEffect(() => {
    const loadBanners = async () => {
      const result = await bannerApi.getAll();
      if (result.success && result.data) {
        const mapped: BannerItem[] = result.data.map((dto: BannerDTO) => normalizeBannerItem({
          id: dto.id,
          title: dto.tieuDe || '',
          subtitle: dto.tieuDePhu || '',
          description: dto.moTa || '',
          imageUrl: dto.hinhAnh || '',
          link: dto.lienKet || '',
          type: (dto.loaiBanner || 'slider') as BannerType,
          position: dto.viTri || 'homepage',
          order: dto.thuTu || 0,
          status: dto.trangThai === 'active' ? 'active' : 'inactive',
          startDate: dto.ngayBatDau || '',
          endDate: dto.ngayKetThuc || '',
        }, (dto.loaiBanner || 'slider') as BannerType, dto.thuTu));
        setBanners(mapped);
      }
    };
    void loadBanners();
  }, []);

  const persistBanners = (list: BannerItem[]) => {
    setBanners(list);
  };

  const saveBannerToBackend = async (banner: BannerItem) => {
    const payload = {
      tieuDe: banner.title,
      tieuDePhu: banner.subtitle || undefined,
      moTa: banner.description || undefined,
      hinhAnh: banner.imageUrl,
      lienKet: banner.link || undefined,
      loaiBanner: banner.type,
      viTri: banner.position || 'homepage',
      thuTu: banner.order,
      trangThai: banner.status || 'active',
      ngayBatDau: banner.startDate || undefined,
      ngayKetThuc: banner.endDate || undefined,
    };
    return payload;
  };

  const filteredBanners = useMemo(
    () =>
      banners
        .filter((banner) => banner.type === activeTab)
        .sort((first, second) => first.order - second.order),
    [activeTab, banners],
  );

  const previewBanner = useMemo(
    () =>
      normalizeBannerItem(
        {
          id: editingBannerId || 0,
          ...form,
        },
        form.type,
        form.order,
      ),
    [editingBannerId, form],
  );

  const openCreateForm = () => {
    setEditingBannerId(null);
    setForm(createBannerDefaults(activeTab, banners));
    setShowForm(true);
  };

  const openEditForm = (banner: BannerItem) => {
    setEditingBannerId(banner.id);
    setForm({ ...banner });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingBannerId(null);
    setForm(createBannerDefaults(activeTab, banners));
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.imageUrl.trim()) {
      notify({
        tone: 'error',
        message: 'Dien đầy đủ tiêu đề và hình ảnh banner trước khi lưu.',
      });
      return;
    }

    const normalizedBanner = normalizeBannerItem(
      {
        id: editingBannerId || Date.now(),
        ...form,
      },
      form.type,
      form.order,
    );

    const payload = await saveBannerToBackend(normalizedBanner);

    if (editingBannerId) {
      const result = await bannerApi.update(editingBannerId, payload);
      if (result.success) {
        setMsg('Đã cập nhật banner.');
      }
    } else {
      const result = await bannerApi.create(payload);
      if (result.success) {
        setMsg('Đã thêm banner mới.');
      }
    }

    // Reload from backend
    const reloadResult = await bannerApi.getAll();
    if (reloadResult.success && reloadResult.data) {
      const mapped: BannerItem[] = reloadResult.data.map((dto: BannerDTO) => normalizeBannerItem({
        id: dto.id,
        title: dto.tieuDe || '',
        subtitle: dto.tieuDePhu || '',
        description: dto.moTa || '',
        imageUrl: dto.hinhAnh || '',
        link: dto.lienKet || '',
        type: (dto.loaiBanner || 'slider') as BannerType,
        position: dto.viTri || 'homepage',
        order: dto.thuTu || 0,
        status: dto.trangThai === 'active' ? 'active' : 'inactive',
        startDate: dto.ngayBatDau || '',
        endDate: dto.ngayKetThuc || '',
      }, (dto.loaiBanner || 'slider') as BannerType, dto.thuTu));
      setBanners(mapped);
    }

    window.setTimeout(() => setMsg(''), 3000);
    closeForm();
  };

  const handleDelete = async (id: number) => {
    const accepted = await confirm({
      title: 'Xóa banner',
      message: 'Banner này sẽ bị gỡ khỏi bố cục hiện tại.',
      confirmLabel: 'Xóa banner',
      tone: 'danger',
      icon: 'fa-images',
    });

    if (!accepted) return;

    const result = await bannerApi.delete(id);
    if (result.success) {
      persistBanners(banners.filter((banner) => banner.id !== id));
      setMsg('Đã xóa banner.');
    }
    window.setTimeout(() => setMsg(''), 3000);
  };

  const handleDuplicate = (banner: BannerItem) => {
    const typeBanners = filteredBanners;
    const duplicate = normalizeBannerItem(
      {
        ...banner,
        id: Date.now(),
        title: `${banner.title} (Bản sao)`,
        status: 'inactive',
      },
      banner.type,
      banner.order + 1,
    );

    const reorderedTypeBanners = typeBanners.flatMap((item) =>
      item.id === banner.id ? [item, duplicate] : [item],
    );

    persistBanners(
      buildOrderedList(
        banners.filter((item) => item.type !== banner.type).concat(reorderedTypeBanners),
        banner.type,
        reorderedTypeBanners.map((item) => item.id),
      ),
    );
    setMsg('Đã nhân bản banner.');
    window.setTimeout(() => setMsg(''), 3000);
  };

  const handleMove = (bannerId: number, direction: 'up' | 'down') => {
    const index = filteredBanners.findIndex((banner) => banner.id === bannerId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (index === -1 || targetIndex < 0 || targetIndex >= filteredBanners.length) {
      return;
    }

    const ordered = [...filteredBanners];
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];

    persistBanners(buildOrderedList(banners, activeTab, ordered.map((banner) => banner.id)));
  };

  const toggleStatus = (bannerId: number) => {
    persistBanners(
      banners.map((banner) =>
        banner.id === bannerId
          ? {
              ...banner,
              status: banner.status === 'active' ? 'inactive' : 'active',
            }
          : banner,
      ),
    );
  };

  return (
    <div className="banner-admin-page">
      <div className="page-header">
        <h1>Quản lý Banner & Slider</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreateForm}>
            <AdminIcon name="fa fa-plus" /> Thêm banner
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success banner-feedback">
          <AdminIcon name="fa fa-check-circle" /> {msg}
        </div>
      )}

      <div className="banner-tab-row">
        <button
          className={`banner-tab-btn ${activeTab === 'slider' ? 'active' : ''}`}
          onClick={() => setActiveTab('slider')}
          type="button"
        >
          <AdminIcon name="fa fa-images" /> Hero slider
        </button>
        <button
          className={`banner-tab-btn ${activeTab === 'banner' ? 'active' : ''}`}
          onClick={() => setActiveTab('banner')}
          type="button"
        >
          <AdminIcon name="fa fa-image" /> Banner quảng cáo
        </button>
      </div>

      <div className="banner-overview-card">
        <div>
          <h3>{activeTab === 'slider' ? 'Slider điều khiển hero trang chủ' : 'Banner quảng cáo'}</h3>
          <p>
            {activeTab === 'slider'
              ? 'Bạn có thể sửa tagline, subtitle, nút chính, nút phụ và sắp xếp thứ tự slide ngay tại đây.'
              : 'Quản lý các banner tĩnh với preview, duplicate, ẩn/hiện và đổi thứ tự hiển thị.'}
          </p>
        </div>
        <div className="banner-overview-meta">
          <strong>{filteredBanners.length}</strong>
          <span>mục đang quản lý</span>
        </div>
      </div>

      <div className="banners-grid">
        {filteredBanners.length === 0 ? (
          <div className="banner-empty-state">
            <AdminIcon name="fa fa-image" />
            <h3>Chưa có banner nào</h3>
            <p>Tạo banner đầu tiên để điều khiển phần hero và khu vực quảng cáo trong app.</p>
          </div>
        ) : (
          filteredBanners.map((banner, index) => (
            <article key={banner.id} className="banner-card">
              <div className="banner-image-wrapper">
                <img src={banner.imageUrl} alt={banner.title} />
                <span className="banner-order-pill">{formatOrderLabel(banner.order)}</span>
                <div className="banner-card-overlay">
                  <button
                    className="banner-overlay-btn"
                    type="button"
                    onClick={() => openEditForm(banner)}
                  >
                    Sửa nhanh
                  </button>
                </div>
              </div>

              <div className="banner-info">
                <div className="banner-info-top">
                  <span className={`banner-status-badge ${banner.status}`}>
                    {banner.status === 'active' ? 'Hiển thị' : 'Đang ẩn'}
                  </span>
                  <span className="banner-position-chip">{banner.position}</span>
                </div>

                <h3 className="banner-title">{banner.title}</h3>
                {banner.tagline && <p className="banner-tagline">{banner.tagline}</p>}
                <p className="banner-subtitle">
                  {banner.subtitle || banner.description || 'Chưa có subtitle cho banner này.'}
                </p>

                <div className="banner-cta-list">
                  <span className="banner-cta-chip primary">
                    {banner.primaryButtonLabel || 'Nut chinh'}
                  </span>
                  {banner.type === 'slider' && (
                    <span className="banner-cta-chip secondary">
                      {banner.secondaryButtonLabel || 'Nút phụ'}
                    </span>
                  )}
                </div>

                <div className="banner-meta">
                  <span>
                    <AdminIcon name="fa fa-link" /> {banner.primaryButtonLink || banner.link || '/products'}
                  </span>
                  <span>
                    <AdminIcon name="fa fa-copy" /> {banner.type}
                  </span>
                </div>

                <div className="banner-actions">
                  <button
                    className="btn-banner"
                    type="button"
                    onClick={() => handleMove(banner.id, 'up')}
                    disabled={index === 0}
                  >
                    <AdminIcon name="fa fa-arrow-up" />
                  </button>
                  <button
                    className="btn-banner"
                    type="button"
                    onClick={() => handleMove(banner.id, 'down')}
                    disabled={index === filteredBanners.length - 1}
                  >
                    <AdminIcon name="fa fa-arrow-down" />
                  </button>
                  <button className="btn-banner" type="button" onClick={() => handleDuplicate(banner)}>
                    <AdminIcon name="fa fa-copy" />
                  </button>
                  <button className="btn-banner" type="button" onClick={() => toggleStatus(banner.id)}>
                    <AdminIcon name={banner.status === 'active' ? 'fa-eye-slash' : 'fa-eye'} />
                  </button>
                  <button className="btn-banner" type="button" onClick={() => openEditForm(banner)}>
                    <AdminIcon name="fa fa-pen" />
                  </button>
                  <button className="btn-banner danger" type="button" onClick={() => handleDelete(banner.id)}>
                    <AdminIcon name="fa fa-trash" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {showForm && (
        <div className="modal active" onClick={closeForm}>
          <div className="modal-dialog modal-lg" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>{editingBannerId ? 'Chinh sửa banner' : 'Thêm banner mới'}</h3>
                <button className="modal-close" onClick={closeForm}>
                  <AdminIcon name="fa fa-times" />
                </button>
              </div>

              <div className="modal-body banner-form-body">
                <div className="banner-form-layout">
                  <div className="banner-form-panel">
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Loai banner</label>
                        <select
                          className="form-control"
                          value={form.type}
                          onChange={(event) => {
                            const nextType = event.target.value as BannerType;
                            setForm((current) => ({
                              ...createBannerDefaults(nextType, banners),
                              title: current.title,
                              description: current.description,
                              subtitle: current.subtitle,
                              tagline: current.tagline,
                              imageUrl: current.imageUrl,
                              primaryButtonLabel: current.primaryButtonLabel,
                              primaryButtonLink: current.primaryButtonLink,
                              secondaryButtonLabel: current.secondaryButtonLabel,
                              secondaryButtonLink: current.secondaryButtonLink,
                              link: current.primaryButtonLink || current.link,
                              type: nextType,
                            }));
                          }}
                        >
                          <option value="slider">Hero slider</option>
                          <option value="banner">Banner quảng cáo</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Trang hiển thị</label>
                        <select
                          className="form-control"
                          value={form.position}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, position: event.target.value }))
                          }
                        >
                          <option value="homepage">Trang chủ</option>
                          <option value="category">Trang danh mục</option>
                          <option value="product">Trang sản phẩm</option>
                          <option value="sidebar">Sidebar</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tiêu đề</label>
                      <input
                        className="form-control"
                        value={form.title}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Everyday Essentials"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tagline / overline</label>
                      <input
                        className="form-control"
                        value={form.tagline}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, tagline: event.target.value }))
                        }
                        placeholder="SPRING / SUMMER 2025"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Subtitle hero</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={form.subtitle}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, subtitle: event.target.value }))
                        }
                        placeholder="Đoạn mô tả hiển thị dưới tiêu đề trong hero slider"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Mô tả / ghi chú</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={form.description}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder="Thông tin phụ để quản trị hoặc fallback subtitle"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">URL hình ảnh</label>
                      <input
                        className="form-control"
                        value={form.imageUrl}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, imageUrl: event.target.value }))
                        }
                        placeholder="https://example.com/hero-banner.jpg"
                      />
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Nut chinh</label>
                        <input
                          className="form-control"
                          value={form.primaryButtonLabel}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              primaryButtonLabel: event.target.value,
                            }))
                          }
                          placeholder="Kham pha ngay"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Link nut chinh</label>
                        <input
                          className="form-control"
                          value={form.primaryButtonLink}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              primaryButtonLink: event.target.value,
                              link: event.target.value,
                            }))
                          }
                          placeholder="/products"
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Nút phụ</label>
                        <input
                          className="form-control"
                          value={form.secondaryButtonLabel}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              secondaryButtonLabel: event.target.value,
                            }))
                          }
                          placeholder="Xem tất cả"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Link nut phu</label>
                        <input
                          className="form-control"
                          value={form.secondaryButtonLink}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              secondaryButtonLink: event.target.value,
                            }))
                          }
                          placeholder="/collections"
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Thứ tự hiển thị</label>
                        <input
                          className="form-control"
                          type="number"
                          min="1"
                          value={form.order}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              order: Number(event.target.value) || 1,
                            }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Trạng thái</label>
                        <select
                          className="form-control"
                          value={form.status}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              status: event.target.value as BannerItem['status'],
                            }))
                          }
                        >
                          <option value="active">Hiển thị</option>
                          <option value="inactive">Tam an</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="banner-preview-panel">
                    <h4>Preview hero</h4>
                    <div className="banner-preview-card">
                      <img src={previewBanner.imageUrl || '/slide_1.jpg'} alt={previewBanner.title} />
                      <div className="banner-preview-overlay">
                        <span className="banner-preview-tagline">
                          {previewBanner.tagline || 'TAGLINE'}
                        </span>
                        <h3>{previewBanner.title || 'Tiêu đề banner'}</h3>
                        <p>
                          {previewBanner.subtitle ||
                            previewBanner.description ||
                            'Subtitle sẽ hiển thị ở đây để bạn căn chỉnh trước khi lưu.'}
                        </p>
                        <div className="banner-preview-actions">
                          <span>{previewBanner.primaryButtonLabel || 'Nut chinh'}</span>
                          <span>{previewBanner.secondaryButtonLabel || 'Nút phụ'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="banner-preview-meta">
                      <div>
                        <strong>Link chinh</strong>
                        <span>{previewBanner.primaryButtonLink || previewBanner.link || '/products'}</span>
                      </div>
                      <div>
                        <strong>Link phụ</strong>
                        <span>{previewBanner.secondaryButtonLink || '/collections'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={closeForm}>
                  Hủy
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <AdminIcon name="fa fa-save" /> Lưu banner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
