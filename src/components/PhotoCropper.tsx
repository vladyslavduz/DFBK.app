import { useEffect, useRef, useState, type PointerEvent } from 'react';
import AppIcon from './AppIcon';

export type PhotoCropPreset = {
  id: 'original' | 'square' | 'portrait' | 'story' | 'landscape';
  label: string;
  shortLabel: string;
  ratio: number | null;
  outputWidth: number;
  outputHeight: number | null;
};

export const PHOTO_CROP_PRESETS: PhotoCropPreset[] = [
  { id: 'original', label: 'Original', shortLabel: 'Original', ratio: null, outputWidth: 1600, outputHeight: null },
  { id: 'square', label: 'Social 1:1', shortLabel: '1:1', ratio: 1, outputWidth: 1080, outputHeight: 1080 },
  { id: 'portrait', label: 'Post 4:5', shortLabel: '4:5', ratio: 4 / 5, outputWidth: 1080, outputHeight: 1350 },
  { id: 'story', label: 'Story / Reel 9:16', shortLabel: '9:16', ratio: 9 / 16, outputWidth: 1080, outputHeight: 1920 },
  { id: 'landscape', label: 'Landscape 1.91:1', shortLabel: '1.91:1', ratio: 1.91, outputWidth: 1200, outputHeight: 628 },
];

type Props = {
  sourceUrl: string;
  sourceFile: File;
  onConfirm: (file: File) => void;
  onCancel: () => void;
};

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = url;
  });
}

function cropRect(image: HTMLImageElement, ratio: number | null, zoom: number, center: Point) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const cropRatio = ratio || imageRatio;
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (imageRatio > cropRatio) width = height * cropRatio;
  else height = width / cropRatio;

  width /= zoom;
  height /= zoom;

  const x = clamp(center.x, width / 2, image.naturalWidth - width / 2) - width / 2;
  const y = clamp(center.y, height / 2, image.naturalHeight - height / 2) - height / 2;
  return { x, y, width, height };
}

function initialCenter(image: HTMLImageElement) {
  return { x: image.naturalWidth / 2, y: image.naturalHeight / 2 };
}

export default function PhotoCropper({ sourceUrl, sourceFile, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ point: Point; center: Point } | null>(null);
  const [presetId, setPresetId] = useState<PhotoCropPreset['id']>('original');
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Point>({ x: 0, y: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preset = PHOTO_CROP_PRESETS.find(item => item.id === presetId) || PHOTO_CROP_PRESETS[0];

  useEffect(() => {
    let active = true;
    setImageReady(false);
    setError('');
    void loadImage(sourceUrl).then(image => {
      if (!active) return;
      imageRef.current = image;
      setCenter(initialCenter(image));
      setZoom(1);
      setImageReady(true);
    }).catch(() => {
      if (active) setError('Das Foto konnte nicht geöffnet werden. Bitte wähle ein anderes Bild.');
    });
    return () => { active = false; };
  }, [sourceUrl]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!image || !canvas || !stage || !imageReady) return;

    const width = Math.max(320, Math.min(900, stage.clientWidth * 2));
    const height = Math.max(220, Math.min(620, stage.clientHeight * 2));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;

    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const displayWidth = image.naturalWidth * scale;
    const displayHeight = image.naturalHeight * scale;
    const offsetX = (width - displayWidth) / 2;
    const offsetY = (height - displayHeight) / 2;
    const rect = cropRect(image, preset.ratio, zoom, center);
    const cropDisplay = {
      x: offsetX + rect.x * scale,
      y: offsetY + rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#111827';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, offsetX, offsetY, displayWidth, displayHeight);
    context.fillStyle = 'rgba(9, 27, 49, .57)';
    context.fillRect(0, 0, width, height);
    context.clearRect(cropDisplay.x, cropDisplay.y, cropDisplay.width, cropDisplay.height);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, cropDisplay.x, cropDisplay.y, cropDisplay.width, cropDisplay.height);
    context.strokeStyle = '#fff';
    context.lineWidth = Math.max(2, scale * 3);
    context.strokeRect(cropDisplay.x, cropDisplay.y, cropDisplay.width, cropDisplay.height);
    context.strokeStyle = 'rgba(255,255,255,.42)';
    context.lineWidth = Math.max(1, scale);
    context.beginPath();
    context.moveTo(cropDisplay.x + cropDisplay.width / 3, cropDisplay.y);
    context.lineTo(cropDisplay.x + cropDisplay.width / 3, cropDisplay.y + cropDisplay.height);
    context.moveTo(cropDisplay.x + cropDisplay.width * 2 / 3, cropDisplay.y);
    context.lineTo(cropDisplay.x + cropDisplay.width * 2 / 3, cropDisplay.y + cropDisplay.height);
    context.moveTo(cropDisplay.x, cropDisplay.y + cropDisplay.height / 3);
    context.lineTo(cropDisplay.x + cropDisplay.width, cropDisplay.y + cropDisplay.height / 3);
    context.moveTo(cropDisplay.x, cropDisplay.y + cropDisplay.height * 2 / 3);
    context.lineTo(cropDisplay.x + cropDisplay.width, cropDisplay.y + cropDisplay.height * 2 / 3);
    context.stroke();
  }, [center, imageReady, preset.ratio, zoom]);

  function setPreset(nextId: PhotoCropPreset['id']) {
    setPresetId(nextId);
    setZoom(1);
    if (imageRef.current) setCenter(initialCenter(imageRef.current));
  }

  function pointerPosition(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * event.currentTarget.width,
      y: ((event.clientY - bounds.top) / bounds.height) * event.currentTarget.height,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!imageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { point: pointerPosition(event), center };
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    if (!image || !canvas || !drag) return;
    const point = pointerPosition(event);
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const nextCenter = {
      x: drag.center.x + (point.x - drag.point.x) / scale,
      y: drag.center.y + (point.y - drag.point.y) / scale,
    };
    const rect = cropRect(image, preset.ratio, zoom, nextCenter);
    setCenter({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  async function confirmCrop() {
    const image = imageRef.current;
    if (!image || busy) return;
    setBusy(true);
    setError('');
    try {
      const rect = cropRect(image, preset.ratio, zoom, center);
      const outputWidth = preset.outputWidth;
      const outputHeight = preset.outputHeight || Math.max(1, Math.round(outputWidth * rect.height / rect.width));
      const output = document.createElement('canvas');
      output.width = outputWidth;
      output.height = outputHeight;
      const context = output.getContext('2d');
      if (!context) throw new Error('CANVAS_UNAVAILABLE');
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, outputWidth, outputHeight);
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/jpeg', .9));
      if (!blob) throw new Error('IMAGE_EXPORT_FAILED');
      const name = sourceFile.name.replace(/\.[^.]+$/, '') || 'dfbk-foto';
      onConfirm(new File([blob], `${name}-dfbk.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    } catch {
      setError('Das zugeschnittene Foto konnte nicht vorbereitet werden. Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-cropper" aria-label="Foto zuschneiden">
      <div className="photo-cropper-heading"><div><span className="app-kicker">Foto vorbereiten</span><h2>Wähle den passenden Bildausschnitt</h2><p>Ziehe das Bild und passe den Ausschnitt für deine Kanäle an.</p></div><span className="photo-cropper-tip">Zieh das Bild mit der Maus oder dem Finger.</span></div>
      <div ref={stageRef} className="photo-crop-stage">
        {imageReady ? <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} aria-label="Bildausschnitt verschieben" /> : <span className="photo-crop-loading">Foto wird vorbereitet …</span>}
      </div>
      <div className="photo-crop-presets" role="group" aria-label="Bildformat auswählen">
        {PHOTO_CROP_PRESETS.map(item => <button key={item.id} type="button" className={item.id === presetId ? 'is-active' : ''} onClick={() => setPreset(item.id)} title={item.label}><span>{item.shortLabel}</span><small>{item.id === 'original' ? 'Original' : item.id === 'story' ? 'Story' : item.id === 'landscape' ? 'Feed' : 'Social'}</small></button>)}
      </div>
      <label className="photo-crop-zoom"><span>Zoom</span><input type="range" min="1" max="3" step=".05" value={zoom} onChange={event => setZoom(Number(event.target.value))} disabled={!imageReady} /><output>{zoom.toFixed(1)}×</output></label>
      {error && <p className="inline-notice" role="alert">{error}</p>}
      <div className="photo-cropper-footer"><button className="text-button" type="button" onClick={onCancel} disabled={busy}>Zurück</button><button className="button" type="button" onClick={() => void confirmCrop()} disabled={!imageReady || busy}>{busy ? 'Wird vorbereitet …' : 'Ausschnitt übernehmen'}<AppIcon name="check" /></button></div>
    </div>
  );
}
