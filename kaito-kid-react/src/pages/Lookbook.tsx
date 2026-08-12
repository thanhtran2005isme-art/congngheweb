// Trang Lookbook - phiên bản nâng cấp
// - Hot-spot pin sản phẩm trên ảnh: hover hiện tooltip, click mở modal
// - Hỗ trợ video lookbook (YouTube embed hoặc MP4)
// - Filter theo season + style

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PiTagSimpleFill, PiPlayCircleFill, PiX, PiArrowRight, PiSparkleFill,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

import { lookbookApi, type PublicLookbookDTO, type LookbookHotspotDTO } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency } from '../utils/format';

// Convert YouTube watch/short URL → embed URL. Trả null nếu không phải YouTube.
function toYoutubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`;
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

export default function Lookbook() {
  const [items, setItems] = useState<PublicLookbookDTO[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [season, setSeason] = useState('');
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);

  // Load filter options 1 lần
  useEffect(() => {
    void lookbookApi.getFilters().then((r) => {
      if (r.success && r.data) {
        setSeasons(r.data.seasons);
        setStyles(r.data.styles);
      }
    });
  }, []);

  // Load list theo filter
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void lookbookApi.getPublic({ season: season || undefined, style: style || undefined }).then((r) => {
      if (!alive) return;
      if (r.success && r.data) {
        setItems(r.data);
      } else {
        toast.error(r.error || 'Không thể tải lookbook');
        setItems([]);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [season, style]);

  const activeVideo = useMemo(() => items.find((i) => i.id === activeVideoId), [items, activeVideoId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="lookbook-page">
      <div className="lookbook-hero">
        <h1>LOOKBOOK</h1>
        <p>Cảm hứng phối đồ từ KAITO KID — chạm vào điểm 🎯 trên ảnh để xem sản phẩm</p>
      </div>

      {/* Filters */}
      {(seasons.length > 0 || styles.length > 0) && (
        <div className="lookbook-filters">
          {seasons.length > 0 && (
            <div className="lb-filter-group">
              <span className="lb-filter-label">Mùa</span>
              <FilterChip active={!season} onClick={() => setSeason('')}>Tất cả</FilterChip>
              {seasons.map((s) => (
                <FilterChip key={s} active={season === s} onClick={() => setSeason(s)}>
                  {s}
                </FilterChip>
              ))}
            </div>
          )}
          {styles.length > 0 && (
            <div className="lb-filter-group">
              <span className="lb-filter-label">Phong cách</span>
              <FilterChip active={!style} onClick={() => setStyle('')}>Tất cả</FilterChip>
              {styles.map((s) => (
                <FilterChip key={s} active={style === s} onClick={() => setStyle(s)}>
                  {s}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="lookbook-container">
        {items.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            Chưa có lookbook phù hợp.
          </p>
        ) : (
          <div className="lookbook-grid lookbook-grid-v2">
            {items.map((item) => (
              <LookbookCard
                key={item.id}
                item={item}
                onPlayVideo={() => setActiveVideoId(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video modal */}
      {activeVideo?.videoUrl && (
        <VideoModal
          url={activeVideo.videoUrl}
          title={activeVideo.title}
          onClose={() => setActiveVideoId(null)}
        />
      )}
    </div>
  );
}

// =============== Subcomponents ===============

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lb-chip ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

function LookbookCard({ item, onPlayVideo }: { item: PublicLookbookDTO; onPlayVideo: () => void }) {
  const [hovered, setHovered] = useState<LookbookHotspotDTO | null>(null);
  const [picked, setPicked] = useState<LookbookHotspotDTO | null>(null);

  return (
    <div className="lookbook-card lookbook-card-v2">
      <div
        className="lookbook-image"
        onMouseLeave={() => setHovered(null)}
      >
        <img src={item.image} alt={item.title}  loading="lazy" decoding="async" />

        {/* Hot-spot pins */}
        {item.hotspots.map((h, i) => (
          <button
            key={h.id}
            className="lb-hotspot"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            onMouseEnter={() => setHovered(h)}
            onClick={(e) => { e.stopPropagation(); setPicked(h); }}
            aria-label={`Sản phẩm ${i + 1}: ${h.productName}`}
          >
            <span className="lb-hotspot-dot">{i + 1}</span>
          </button>
        ))}

        {/* Tooltip on hover */}
        {hovered && (
          <div
            className="lb-hotspot-tooltip"
            style={{ left: `${hovered.x}%`, top: `${hovered.y}%` }}
          >
            {hovered.productImage && <img src={hovered.productImage} alt=""  loading="lazy" decoding="async" />}
            <div className="lb-hotspot-info">
              <div className="lb-hotspot-name">{hovered.productName}</div>
              <div className="lb-hotspot-price">
                {formatCurrency(hovered.productPrice)}
                {hovered.productOldPrice && (
                  <span className="lb-hotspot-old">{formatCurrency(hovered.productOldPrice)}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Play video badge */}
        {item.videoUrl && (
          <button
            className="lb-play-btn"
            onClick={onPlayVideo}
            aria-label="Xem video lookbook"
            title="Xem video lookbook"
          >
            <PiPlayCircleFill />
          </button>
        )}

        {/* Tag count badge */}
        {item.hotspots.length > 0 && (
          <div className="lb-tag-count">
            <PiTagSimpleFill /> {item.hotspots.length}
          </div>
        )}
      </div>

      <div className="lookbook-overlay">
        <div className="lb-meta">
          {item.season && <span><PiSparkleFill /> {item.season}</span>}
          {item.style && <span>{item.style}</span>}
        </div>
        <h3>{item.title}</h3>
        {item.subtitle && <p style={{ fontStyle: 'italic' }}>{item.subtitle}</p>}
        {item.description && <p>{item.description}</p>}
        {item.link && (
          <a href={item.link} className="btn-shop-look">
            Mua ngay <PiArrowRight />
          </a>
        )}
      </div>

      {/* Picked product modal */}
      {picked && (
        <div className="vp-overlay" onClick={() => setPicked(null)}>
          <div className="vp-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <button className="vp-close" onClick={() => setPicked(null)}><PiX /></button>
            {picked.productImage && (
              <img
                src={picked.productImage}
                alt={picked.productName}
                style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }}
               loading="lazy" decoding="async" />
            )}
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{picked.productName}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', margin: '8px 0 12px' }}>
              <span style={{ color: '#dc2626', fontSize: 20, fontWeight: 700 }}>{formatCurrency(picked.productPrice)}</span>
              {picked.productOldPrice && (
                <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontSize: 13 }}>{formatCurrency(picked.productOldPrice)}</span>
              )}
            </div>
            {picked.note && <p style={{ color: '#475569', fontSize: 13 }}>{picked.note}</p>}
            <Link
              to={`/product/${picked.productId}`}
              className="vp-submit"
              style={{ textDecoration: 'none', justifyContent: 'center' }}
            >
              Xem sản phẩm <PiArrowRight />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const youtube = toYoutubeEmbed(url);
  return (
    <div className="vp-overlay" onClick={onClose}>
      <div
        className="vp-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 880, padding: 16 }}
      >
        <button className="vp-close" onClick={onClose}><PiX /></button>
        <h3 style={{ margin: '4px 8px 12px' }}>{title}</h3>
        <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
          {youtube ? (
            <iframe
              title={title}
              src={youtube}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <video
              src={url}
              controls
              autoPlay
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
