import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';
import { useUserArea } from '../contexts/UserAreaContext';
import { getProjectMediaUrl } from '../services/projects';

type Props = {
  projectId: string;
  originalImage: string | null;
  optimizedImage: string | null;
  mediaLoadError?: string;
  onImagesChange?: (originalImage: string | null, optimizedImage: string | null) => void;
};

type ImageMode = 'original' | 'optimized';

export default function ProjectImageViewer({ projectId, originalImage, optimizedImage, mediaLoadError = '', onImagesChange }: Props) {
  const { optimizeProjectImage } = useUserArea();
  const [imageMode, setImageMode] = useState<ImageMode>(optimizedImage ? 'optimized' : 'original');
  const [retrying, setRetrying] = useState(false);
  const [optimizationError, setOptimizationError] = useState('');

  useEffect(() => {
    if (optimizedImage) setImageMode('optimized');
    else setImageMode('original');
  }, [optimizedImage]);

  async function retryOptimization() {
    if (retrying || !originalImage) return;
    setRetrying(true);
    setOptimizationError('');
    try {
      const media = await optimizeProjectImage(projectId);
      const nextOriginal = media.original ? getProjectMediaUrl(projectId, media.original.id) : originalImage;
      const nextOptimized = media.optimized ? getProjectMediaUrl(projectId, media.optimized.id) : null;
      onImagesChange?.(nextOriginal, nextOptimized);
      setImageMode(nextOptimized ? 'optimized' : 'original');
      if (!nextOptimized) setOptimizationError('Die Fotooptimierung konnte nicht abgeschlossen werden.');
    } catch {
      setOptimizationError('Die Fotooptimierung konnte nicht abgeschlossen werden. Du kannst weiterhin das Original verwenden.');
      setImageMode('original');
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

  return (
    <section className="project-image-card ki-image-viewer">
      <div className="image-toggle" role="group" aria-label="Bildversion wählen">
        <button type="button" aria-pressed={!showingOptimized} className={!showingOptimized ? 'is-active' : ''} onClick={() => setImageMode('original')}>Original</button>
        <button type="button" aria-pressed={showingOptimized} className={showingOptimized ? 'is-active' : ''} disabled={!optimizedImage} onClick={() => optimizedImage && setImageMode('optimized')}>KI-optimiert</button>
      </div>

      <div className="ki-image-stage">
        <img className={showingOptimized ? 'is-optimized' : ''} src={displayedImage} alt={showingOptimized ? 'KI-optimierte Projektaufnahme' : 'Originale Projektaufnahme'} />
        {retrying && <div className="ki-image-processing" aria-live="polite"><span className="processing-orb"><AppIcon name="spark" /></span><strong>DFBK.app optimiert dein Foto …</strong></div>}
      </div>

      {(mediaLoadError || optimizationError || !optimizedImage) && !retrying && (
        <div className="ki-image-notice" role="status">
          <p>{optimizationError || mediaLoadError || 'Eine KI-optimierte Version ist aktuell noch nicht verfügbar. Das Original bleibt vollständig nutzbar.'}</p>
        </div>
      )}

      <div className="project-image-actions ki-image-actions">
        <a className="button button-secondary" href={displayedImage} download={showingOptimized ? 'dfbk-projektbild-ki-optimiert' : 'dfbk-projektbild-original'}><AppIcon name="download" />{showingOptimized ? 'KI-optimiert herunterladen' : 'Original herunterladen'}</a>
        <button className="button button-secondary" type="button" disabled={retrying} onClick={() => void retryOptimization()}>{retrying ? 'Wird optimiert …' : 'Erneut optimieren'}</button>
      </div>
    </section>
  );
}
