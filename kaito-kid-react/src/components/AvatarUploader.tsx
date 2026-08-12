// Avatar uploader với crop hình tròn (Canvas API, không cần lib ngoài).
// Trả base64 data-URL JPEG nén ~85% để lưu vào field `avatar` của AccountDTO.
import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { PiCameraFill, PiX, PiCheckBold, PiArrowsClockwise } from 'react-icons/pi';

interface Props {
  current?: string | null;
  size?: number; // output px (default 320)
  onSave: (blob: Blob) => Promise<void> | void;
}

export default function AvatarUploader({ current, size = 320, onSave }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, () => setOpen(false));

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh tối đa 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setOpen(true);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Vẽ preview liên tục theo zoom/offset
  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Cover-fit
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    const dW = img.naturalWidth * scale;
    const dH = img.naturalHeight * scale;
    const dx = (W - dW) / 2 + offset.x;
    const dy = (H - dH) / 2 + offset.y;
    ctx.drawImage(img, dx, dy, dW, dH);

    // Vùng tròn highlight
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 8, 0, Math.PI * 2);
    ctx.stroke();
  };

  useEffect(() => { if (open) draw(); /* eslint-disable-next-line */ }, [open, zoom, offset, src]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy });
  };
  const handleMouseUp = () => { dragRef.current = null; };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(4, z + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  const handleConfirm = async () => {
    if (!canvasRef.current || !imgRef.current) return;
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    const img = imgRef.current;
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight) * zoom;
    const dW = img.naturalWidth * scale;
    const dH = img.naturalHeight * scale;
    // Tỷ lệ offset từ canvas preview (300) → output (size)
    const ratio = size / 300;
    const dx = (size - dW) / 2 + offset.x * ratio;
    const dy = (size - dH) / 2 + offset.y * ratio;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, dx, dy, dW, dH);
    setSaving(true);
    try {
      const blob: Blob = await new Promise((resolve, reject) =>
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
      );
      await onSave(blob);
      setOpen(false);
      setSrc(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="avatar-uploader">
        <div className="avatar-uploader-img" onClick={handlePick} title="Đổi ảnh đại diện">
          {current ? (
            <img src={current} alt="Avatar" />
          ) : (
            <div className="avatar-uploader-placeholder">
              <PiCameraFill />
            </div>
          )}
          <div className="avatar-uploader-overlay">
            <PiCameraFill />
            <span>Đổi ảnh</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {open && src && (
        <div className="vp-overlay" onClick={() => !saving && setOpen(false)}>
          <div ref={dialogRef} className="vp-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }} role="dialog" aria-modal="true" aria-label="Cắt ảnh đại diện">
            <button className="vp-close" onClick={() => setOpen(false)} disabled={saving}>
              <PiX />
            </button>
            <h3 style={{ margin: '0 0 6px' }}>Cắt ảnh đại diện</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 0 }}>Kéo để di chuyển, lăn chuột để zoom.</p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ borderRadius: 8, cursor: dragRef.current ? 'grabbing' : 'grab' }}
              />
              <img
                ref={imgRef}
                src={src}
                alt=""
                style={{ display: 'none' }}
                onLoad={draw}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <PiArrowsClockwise />
              <input
                type="range"
                min={1} max={4} step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="vp-submit"
                style={{ marginTop: 0 }}
              >
                <PiCheckBold /> {saving ? 'Đang lưu...' : 'Lưu ảnh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
