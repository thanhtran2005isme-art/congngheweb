import { useEffect, useMemo, useState } from 'react';
import {
  getDefaultFooterConfig,
  type FooterConfig,
  type FooterContactItem,
  type FooterLinkItem,
  type FooterSocialItem,
} from '../utils/footerConfig';
import { menuApi, type MenuDTO } from '../services/api';
import AdminIcon from '../components/admin/AdminIcon';


function createId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function moveItem<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export default function AdminMenus() {
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(getDefaultFooterConfig());
  const [menus, setMenus] = useState<MenuDTO[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const loadMenus = async () => {
      const result = await menuApi.getAll();
      if (result.success && result.data) {
        setMenus(result.data);
        // Build footer config from menu data
        const headerMenus = result.data.filter((m) => m.viTri === 'header');
        const footerMenus = result.data.filter((m) => m.viTri === 'footer');
        if (headerMenus.length > 0 || footerMenus.length > 0) {
          setFooterConfig((current) => ({
            ...current,
            about: {
              ...current.about,
              links: footerMenus.map((m) => ({ label: m.tenMenu, href: m.lienKet, id: m.id, target: '_self' })),
            },
          }));
        }
      }
    };
    void loadMenus();
  }, []);

  const stats = useMemo(() => ({
    totalLinks:
      footerConfig.about.links.length +
      footerConfig.support.links.length +
      footerConfig.social.links.length,
    contactItems: footerConfig.about.contacts.length,
    socialItems: footerConfig.social.links.length,
  }), [footerConfig]);

  const handleSaveAll = async () => {
    // Save footer links as menu items to backend
    const allLinks = [
      ...footerConfig.about.links.map((link, i) => ({
        tenMenu: link.label,
        lienKet: link.href,
        viTri: 'footer',
        thuTu: i,
        trangThai: true,
      })),
      ...footerConfig.support.links.map((link, i) => ({
        tenMenu: link.label,
        lienKet: link.href,
        viTri: 'footer-support',
        thuTu: i,
        trangThai: true,
      })),
    ];

    // Delete existing footer menus and recreate
    const existingFooter = menus.filter((m) => m.viTri === 'footer' || m.viTri === 'footer-support');
    for (const m of existingFooter) {
      await menuApi.delete(m.id);
    }
    for (const link of allLinks) {
      await menuApi.create(link);
    }

    setMsg('Đã lưu cấu hình menu.');
    window.setTimeout(() => setMsg(''), 3000);
  };

  const updateAboutLink = (index: number, patch: Partial<FooterLinkItem>) => {
    setFooterConfig((current) => ({
      ...current,
      about: {
        ...current.about,
        links: current.about.links.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        ),
      },
    }));
  };

  const updateSupportLink = (index: number, patch: Partial<FooterLinkItem>) => {
    setFooterConfig((current) => ({
      ...current,
      support: {
        ...current.support,
        links: current.support.links.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        ),
      },
    }));
  };

  const updateContact = (index: number, patch: Partial<FooterContactItem>) => {
    setFooterConfig((current) => ({
      ...current,
      about: {
        ...current.about,
        contacts: current.about.contacts.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        ),
      },
    }));
  };

  const updateSocial = (index: number, patch: Partial<FooterSocialItem>) => {
    setFooterConfig((current) => ({
      ...current,
      social: {
        ...current.social,
        links: current.social.links.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        ),
      },
    }));
  };

  return (
    <div className="footer-admin-page">
      <div className="page-header">
        <h1>Quản lý Footer</h1>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => setFooterConfig(getDefaultFooterConfig())}>
            <AdminIcon name="fa fa-rotate-left" /> Ve mặc định
          </button>
          <button className="btn btn-primary" onClick={handleSaveAll}>
            <AdminIcon name="fa fa-save" /> Lưu thay đổi
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success footer-admin-feedback">
          <AdminIcon name="fa fa-check-circle" /> {msg}
        </div>
      )}

      <div className="footer-admin-stats">
        <div className="footer-admin-stat">
          <strong>4</strong>
          <span>Cột footer dang quản lý</span>
        </div>
        <div className="footer-admin-stat">
          <strong>{stats.totalLinks}</strong>
          <span>Tong link & social</span>
        </div>
        <div className="footer-admin-stat">
          <strong>{stats.contactItems}</strong>
          <span>Thông tin liên hệ</span>
        </div>
        <div className="footer-admin-stat">
          <strong>{stats.socialItems}</strong>
          <span>Kenh social</span>
        </div>
      </div>

      <div className="footer-admin-layout">
        <div className="footer-editor-grid">
          <section className="footer-editor-card">
            <div className="footer-editor-card-header">
              <div>
                <h3>Giới thiệu</h3>
                <p>Quản lý cột link giới thiệu và thông tin liên hệ.</p>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() =>
                  setFooterConfig((current) => ({
                    ...current,
                    about: {
                      ...current.about,
                      links: [
                        ...current.about.links,
                        { id: createId(), label: 'Liên kết mới', href: '#', target: '_self' },
                      ],
                    },
                  }))
                }
              >
                <AdminIcon name="fa fa-plus" /> Thêm link
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề cột</label>
              <input
                className="form-control"
                value={footerConfig.about.title}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    about: { ...current.about, title: event.target.value },
                  }))
                }
              />
            </div>

            <div className="footer-item-list">
              {footerConfig.about.links.map((item, index) => (
                <div key={item.id} className="footer-item-editor">
                  <div className="footer-item-row">
                    <input
                      className="form-control"
                      value={item.label}
                      onChange={(event) => updateAboutLink(index, { label: event.target.value })}
                      placeholder="Ten liên kết"
                    />
                    <input
                      className="form-control"
                      value={item.href}
                      onChange={(event) => updateAboutLink(index, { href: event.target.value })}
                      placeholder="/about hoặc https://..."
                    />
                  </div>
                  <div className="footer-item-row compact">
                    <select
                      className="form-control"
                      value={item.target}
                      onChange={(event) =>
                        updateAboutLink(index, { target: event.target.value as FooterLinkItem['target'] })
                      }
                    >
                      <option value="_self">Cung tab</option>
                      <option value="_blank">Tab mới</option>
                    </select>
                    <div className="footer-item-actions">
                      <button className="btn-icon" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        about: { ...current.about, links: moveItem(current.about.links, index, 'up') },
                      }))} disabled={index === 0}>
                        <AdminIcon name="fa fa-arrow-up" />
                      </button>
                      <button className="btn-icon" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        about: { ...current.about, links: moveItem(current.about.links, index, 'down') },
                      }))} disabled={index === footerConfig.about.links.length - 1}>
                        <AdminIcon name="fa fa-arrow-down" />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        about: { ...current.about, links: current.about.links.filter((link) => link.id !== item.id) },
                      }))}>
                        <AdminIcon name="fa fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="footer-subsection">
              <div className="footer-editor-card-header nested">
                <div>
                  <h4>Thông tin liên hệ</h4>
                  <p>Email, hotline và cac thông tin hien dưới cột giới thiệu.</p>
                </div>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() =>
                    setFooterConfig((current) => ({
                      ...current,
                      about: {
                        ...current.about,
                        contacts: [
                          ...current.about.contacts,
                          { id: createId(), label: 'Thông tin', value: '', href: '' },
                        ],
                      },
                    }))
                  }
                >
                  <AdminIcon name="fa fa-plus" /> Thêm contact
                </button>
              </div>

              <div className="footer-item-list">
                {footerConfig.about.contacts.map((item, index) => (
                  <div key={item.id} className="footer-item-editor">
                    <div className="footer-item-row">
                      <input
                        className="form-control"
                        value={item.label}
                        onChange={(event) => updateContact(index, { label: event.target.value })}
                        placeholder="Email / Hotline"
                      />
                      <input
                        className="form-control"
                        value={item.value}
                        onChange={(event) => updateContact(index, { value: event.target.value })}
                        placeholder="Giá trị hiển thị"
                      />
                    </div>
                    <div className="footer-item-row compact">
                      <input
                        className="form-control"
                        value={item.href || ''}
                        onChange={(event) => updateContact(index, { href: event.target.value })}
                        placeholder="mailto:... / tel:..."
                      />
                      <div className="footer-item-actions">
                        <button className="btn-icon btn-danger" onClick={() => setFooterConfig((current) => ({
                          ...current,
                          about: { ...current.about, contacts: current.about.contacts.filter((contact) => contact.id !== item.id) },
                        }))}>
                          <AdminIcon name="fa fa-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="footer-editor-card">
            <div className="footer-editor-card-header">
              <div>
                <h3>Hỗ trợ khách hàng</h3>
                <p>Quản lý danh sách link o cột hỗ trợ.</p>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() =>
                  setFooterConfig((current) => ({
                    ...current,
                    support: {
                      ...current.support,
                      links: [
                        ...current.support.links,
                        { id: createId(), label: 'Liên kết mới', href: '#', target: '_self', icon: '' },
                      ],
                    },
                  }))
                }
              >
                <AdminIcon name="fa fa-plus" /> Thêm link
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề cột</label>
              <input
                className="form-control"
                value={footerConfig.support.title}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    support: { ...current.support, title: event.target.value },
                  }))
                }
              />
            </div>

            <div className="footer-item-list">
              {footerConfig.support.links.map((item, index) => (
                <div key={item.id} className="footer-item-editor">
                  <div className="footer-item-row">
                    <input
                      className="form-control"
                      value={item.label}
                      onChange={(event) => updateSupportLink(index, { label: event.target.value })}
                      placeholder="Ten liên kết"
                    />
                    <input
                      className="form-control"
                      value={item.href}
                      onChange={(event) => updateSupportLink(index, { href: event.target.value })}
                      placeholder="/order-tracking"
                    />
                  </div>
                  <div className="footer-item-row compact three">
                    <input
                      className="form-control"
                      value={item.icon || ''}
                      onChange={(event) => updateSupportLink(index, { icon: event.target.value })}
                      placeholder="fa fa-box"
                    />
                    <select
                      className="form-control"
                      value={item.target}
                      onChange={(event) =>
                        updateSupportLink(index, { target: event.target.value as FooterLinkItem['target'] })
                      }
                    >
                      <option value="_self">Cung tab</option>
                      <option value="_blank">Tab mới</option>
                    </select>
                    <div className="footer-item-actions">
                      <button className="btn-icon" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        support: { ...current.support, links: moveItem(current.support.links, index, 'up') },
                      }))} disabled={index === 0}>
                        <AdminIcon name="fa fa-arrow-up" />
                      </button>
                      <button className="btn-icon" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        support: { ...current.support, links: moveItem(current.support.links, index, 'down') },
                      }))} disabled={index === footerConfig.support.links.length - 1}>
                        <AdminIcon name="fa fa-arrow-down" />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        support: { ...current.support, links: current.support.links.filter((link) => link.id !== item.id) },
                      }))}>
                        <AdminIcon name="fa fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="footer-editor-card">
            <div className="footer-editor-card-header">
              <div>
                <h3>Hệ thống cửa hàng</h3>
                <p>Quản lý tiêu đề, mô tả và iframe map cua footer.</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề cột</label>
              <input
                className="form-control"
                value={footerConfig.store.title}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    store: { ...current.store, title: event.target.value },
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mô tả ngắn</label>
              <input
                className="form-control"
                value={footerConfig.store.description}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    store: { ...current.store, description: event.target.value },
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Google Maps embed URL</label>
              <textarea
                className="form-control"
                rows={6}
                value={footerConfig.store.mapEmbedUrl}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    store: { ...current.store, mapEmbedUrl: event.target.value },
                  }))
                }
                placeholder="Dan link embed cua Google Maps vào day"
              />
            </div>
          </section>

          <section className="footer-editor-card">
            <div className="footer-editor-card-header">
              <div>
                <h3>Kết nối & bản quyền</h3>
                <p>Quản lý cột social và động copyright dưới footer.</p>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() =>
                  setFooterConfig((current) => ({
                    ...current,
                    social: {
                      ...current.social,
                      links: [
                        ...current.social.links,
                        { id: createId(), label: 'Social', href: '#', icon: 'fab fa-facebook' },
                      ],
                    },
                  }))
                }
              >
                <AdminIcon name="fa fa-plus" /> Thêm social
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề cột</label>
              <input
                className="form-control"
                value={footerConfig.social.title}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    social: { ...current.social, title: event.target.value },
                  }))
                }
              />
            </div>

            <div className="footer-item-list">
              {footerConfig.social.links.map((item, index) => (
                <div key={item.id} className="footer-item-editor">
                  <div className="footer-item-row compact three">
                    <input
                      className="form-control"
                      value={item.label}
                      onChange={(event) => updateSocial(index, { label: event.target.value })}
                      placeholder="Facebook"
                    />
                    <input
                      className="form-control"
                      value={item.icon}
                      onChange={(event) => updateSocial(index, { icon: event.target.value })}
                      placeholder="fab fa-facebook"
                    />
                    <input
                      className="form-control"
                      value={item.href}
                      onChange={(event) => updateSocial(index, { href: event.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="footer-item-row compact">
                    <div className="footer-social-preview">
                      <AdminIcon name={item.icon} />
                      <span>{item.label}</span>
                    </div>
                    <div className="footer-item-actions">
                      <button className="btn-icon" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        social: { ...current.social, links: moveItem(current.social.links, index, 'up') },
                      }))} disabled={index === 0}>
                        <AdminIcon name="fa fa-arrow-up" />
                      </button>
                      <button className="btn-icon" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        social: { ...current.social, links: moveItem(current.social.links, index, 'down') },
                      }))} disabled={index === footerConfig.social.links.length - 1}>
                        <AdminIcon name="fa fa-arrow-down" />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => setFooterConfig((current) => ({
                        ...current,
                        social: { ...current.social, links: current.social.links.filter((link) => link.id !== item.id) },
                      }))}>
                        <AdminIcon name="fa fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-group footer-copyright-group">
              <label className="form-label">Copyright</label>
              <input
                className="form-control"
                value={footerConfig.copyright}
                onChange={(event) =>
                  setFooterConfig((current) => ({
                    ...current,
                    copyright: event.target.value,
                  }))
                }
              />
            </div>
          </section>
        </div>

        <aside className="footer-preview-card">
          <div className="footer-preview-header">
            <h3>Preview footer</h3>
            <p>Ban xem truoc bố cục 4 cột, social và map ngay trong trang quản trị.</p>
          </div>

          <div className="footer-preview-shell">
            <div className="footer-preview-grid">
              <div className="footer-preview-column">
                <h4>{footerConfig.about.title}</h4>
                {footerConfig.about.links.map((item) => (
                  <span key={item.id}>{item.label}</span>
                ))}
                <div className="footer-preview-contact">
                  {footerConfig.about.contacts.map((item) => (
                    <div key={item.id}>
                      <strong>{item.label}:</strong>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="footer-preview-column">
                <h4>{footerConfig.support.title}</h4>
                {footerConfig.support.links.map((item) => (
                  <span key={item.id}>
                    {item.icon ? <AdminIcon name={item.icon} /> : null}
                    {item.label}
                  </span>
                ))}
              </div>

              <div className="footer-preview-column">
                <h4>{footerConfig.store.title}</h4>
                <p>{footerConfig.store.description}</p>
                <div className="footer-preview-map">Map preview</div>
              </div>

              <div className="footer-preview-column">
                <h4>{footerConfig.social.title}</h4>
                <div className="footer-preview-socials">
                  {footerConfig.social.links.map((item) => (
                    <span key={item.id} className="footer-preview-social">
                      <AdminIcon name={item.icon} />
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="footer-preview-bottom">
              <span>{footerConfig.copyright}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
