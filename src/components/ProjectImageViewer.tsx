import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { useUserArea } from '../contexts/UserAreaContext';
import { getProjectMediaUrl } from '../services/projects';
import type { PhotoOptimizationState } from '../types/models';

type Props = {
  projectId: string;
  originalImage: string | null;
  optimizedImage: string | null;
  photoOptimizationState: PhotoOptimizationState;
  mediaLoadError?: string;
  onImagesChange?: (originalImage: string | null, optimizedImage: string | null) => void;
  onOptimizationStateChange?: (state: PhotoOptimizationState) => void;
};

type ImageMode = 'original' | 'optimized';

export default function ProjectImageViewer({
  projectId,
  originalImage,
  optimizedImage,
  photoOptimizationState,
  mediaLoadError = '',
  onImagesChange,
  onOptimizationStateChange,
}: Props) {
  const { optimizeProjectImage, getProjectMedia } = useUserArea();
  const [imageMode, setImageMode] = useState<ImageMode>(optimizedImage ? 'optimized' : 'original');
  const [retrying, setRetrying] = useState(false);
  const [optimizationError, setOptimizationError] = useState('');
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    setImageMode(optimizedImage ? 'optimized' : 'original');
  }, [optimizedImage]);

  useEffect(() => {
    if (photoOptimizationState !== 'processing') {
      pollCount.current = 0;
      setPollingExhausted(false);
      return;
    }
    let active = true;
    let timeoutId = 0;

    async function poll() {
      if (!active || pollCount.current >= 6) {
        if (active) setPollingExhausted(true);
        return;
      }
      try {
        const state = await getProjectMedia(projectId);
        if (!active) return;
        const nextOriginal = state.media.original ? getProjectMediaUrl(projectId, state.media.original.id) : originalImage;
        const nextOptimized = state.media.optimized ? getProjectMediaUrl(projectId, state.media.optimized.id) : null;
        onImagesChange?.(nextOriginal, nextOptimized);
        onOptimizationStateChange?.(state.photoOptimization.state);
        if (state.photoOptimization.state === 'completed') {
          setOptimizationError('');
          setImageMode(nextOptimized ? 'optimized' : 'original');
          return;
        }
        if (state.photoOptimization.state === 'available') {
          setOptimizationError('Optimierung konnte nicht abgeschlossen werden. Erneut versuchen.');
          return;
        }
      } catch {
        // Keep the confirmed processing state; manual refresh remains available.
      }
      pollCount.current += 1;
      if (active && pollCount.current < 6) {
        const delay = Math.min(2000 + pollCount.current * 1000, 6000);
        timeoutId = window.setTimeout(() => void poll(), delay);
      } else if (active) {
        setPollingExhausted(true);
      }
    }

    timeoutId = window.setTimeout(() => void poll(), 1800);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [getProjectMedia, onImagesChange, onOptimizationStateChange, originalImage, photoOptimizationState, projectId]);

  async function refreshOptimizationStatus() {
    try {
      const state = await getProjectMedia(projectId);
      const nextOriginal = state.media.original ? getProjectMediaUrl(projectId, state.media.original.id) : originalImage;
      const nextOptimized = state.media.optimized ? getProjectMediaUrl(projectId, state.media.optimized.id) : null;
      onImagesChange?.(nextOriginal, nextOptimized);
      onOptimizationStateChange?.(state.photoOptimization.state);
      setPollingExhausted(false);
      pollCount.current = 0;
      if (state.photoOptimization.state === 'completed') {
        setOptimizationError('');
        setImageMode(nextOptimized ? 'optimized' : 'original');
      } else if (state.photoOptimization.state === 'available') {
        setOptimizationError('Optimierung konnte nicht abgeschlossen werden. Erneut versuchen.');
      }
    } catch {
      setOptimizationError('Der Status der Fotooptimierung konnte nicht geladen werden.');
    }
  }

  async function retryOptimization() {
    if (retrying || !originalImage || photoOptimizationState !== 'available') return;
    setRetrying(true);
    setOptimizationError('');
    try {
      const state = await optimizeProjectImage(projectId);
      const nextOriginal = state.media.original ? getProjectMediaUrl(projectId, state.media.original.id) : originalImage;
      const nextOptimized = state.media.optimized ? getProjectMediaUrl(projectId, state.media.optimized.id) : null;
      onImagesChange?.(nextOriginal, nextOptimized);
      onOptimizationStateChange?.(state.photoOptimization.state);
      setImageMode(nextOptimized ? 'optimized' : 'original');
      if (state.photoOptimization.state === 'available' && !nextOptimized) {
        setOptimizationError('Optimierung konnte nicht abgeschlossen werden. Erneut versuchen.');
      }
    } catch {
      try {
        const state = await getProjectMedia(projectId);
        const nextOriginal = state.media.original ? getProjectMediaUrl(projectId, state.media.original.id) : originalImage;
        const nextOptimized = state.media.optimized ? getProjectMediaUrl(projectId, state.media.optimized.id) : null;
        onImagesChange?.(nextOriginal, nextOptimized);
        onOptimizationStateChange?.(state.photoOptimization.state);
        if (state.photoOptimization.state === 'available') {
          setOptimizationError('Optimierung konnte nicht abgeschlossen werden. Erneut versuchen.');
        }
      } catch {
        setOptimizationError('Der Status der Fotooptimierung konnte nicht bestätigt werden. Bitte aktualisiere das Projekt.');
      }
    } finally {
      setRetrying(false);
    }
  }

  if (!originalImage) {
    return (
      <section className="project-image-card image-state-card" role="alert">
        <span className="processing-orb"><AppIcon name="folder" /></span>
        <h2>Originalfoto nicht verfügbar</h2>
        <p>Das Projekt ist vorhanden, aber das Originalbild konnte nicht geladen werden.</p>
      </section>
    );
  }

  const displayedImage = imageMode === 'optimized' && optimizedImage ? optimizedImage : originalImage;
  const showingOptimized = imageMode === 'optimized' && Boolean(optimizedImage);
  const processing = photoOptimizationState === 'processing' || retrying;
  const completed = photoOptimizationState === 'completed';

  return (
    <section className="project-image-card ki-image-viewer">
      <div className="image-toggle" role="group" aria-label="Bildversion wählen">
        <button type="button" aria-pressed={!showingOptimized} className={!showingOptimized ? 'is-active' : ''} onClick={() => setImageMode('original')}>Original</button>
        <button type="button" aria-pressed={showingOptimized} className={showingOptimized ? 'is-active' : ''} disabled={!optimizedImage} onClick={() => optimizedImage && setImageMode('optimized')} aria-label="Optimiert">
          <span className="dfbk-optimized-label"><span className="dfbk-mini-brand"><b>DFBK</b><span className="dfbk-mini-dot">.</span><span className="dfbk-mini-app">app</span></span><span>optimiert</span></span>
        </button>
      </div>

      <div className="ki-image-stage">
        <img className={showingOptimized ? 'is-optimized' : ''} src={displayedImage} alt={showingOptimized ? 'Optimierte Projektaufnahme' : 'Originale Projektaufnahme'} />
        {processing && <div className="ki-image-processing" aria-live="polite"><span className="processing-orb"><AppIcon name="spark" /></span><strong>Foto wird optimiert…</strong></div>}
      </div>

      {(mediaLoadError || optimizationError) && !processing && (
        <div className="ki-image-notice" role="status"><p>{optimizationError || mediaLoadError}</p></div>
      )}

      <div className="project-image-actions ki-image-actions">
        <a className="button button-secondary" href={displayedImage} download={showingOptimized ? 'dfbk-projektbild-optimiert' : 'dfbk-projektbild-original'}><AppIcon name="download" />{showingOptimized ? 'Optimiertes Bild herunterladen' : 'Original herunterladen'}</a>
        {completed
          ? <span className="project-status status-ready"><AppIcon name="check" />Foto optimiert</span>
          : photoOptimizationState === 'processing' && pollingExhausted
            ? <button className="button button-secondary" type="button" onClick={() => void refreshOptimizationStatus()}>Status aktualisieren</button>
            : <button className="button button-secondary" type="button" disabled={processing} onClick={() => void retryOptimization()}>{processing ? 'Foto wird optimiert…' : optimizationError ? 'Erneut versuchen' : 'Foto optimieren'}</button>}
      </div>
    </section>
  );
}
