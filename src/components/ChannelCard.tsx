import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';
import SocialPublishModal from './SocialPublishModal';
import { useSocialPublishing } from '../contexts/SocialPublishingContext';
import { useUserArea, type ContentChannel } from '../contexts/UserAreaContext';
import { getProjectMediaUrl, projectService } from '../services/projects';
import { prepareProjectShareImage, shareProjectContent, type ShareOutcome } from '../services/share';

const labels: Record<ContentChannel, { title: string; description: string }> = {
  google: { title: 'Google Business', description: 'Für dein Google Business Profil' },
  social: { title: 'Social Media', description: 'Bild + Beitragstext für deine Social-Media-Kanäle' },
  website: { title: 'Website / Referenz', description: 'Für Referenzen und Projektseiten' },
};

type Props = {
  channel: ContentChannel;
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  projectTitle?: string;
  downloadImage?: string | null;
};

function shareFeedback(outcome: ShareOutcome) {
  if (outcome === 'shared') return 'Bild und Text wurden an das Teilen-Menü übergeben.';
  if (outcome === 'text-shared') return 'Text wurde an das Teilen-Menü übergeben. Das Bild kannst du separat herunterladen.';
  if (outcome === 'unsupported') return 'Teilen wird hier nicht unterstützt. Nutze Kopieren und Bild herunterladen.';
  return '';
}

export default function ChannelCard({ channel, value, onChange, projectId, projectTitle, downloadImage }: Props) {
  const { plan } = useUserArea();
  const { draft } = useSocialPublishing();
  const [editing, setEditing] = useState(false);
  const [socialDraft, setSocialDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [socialImage, setSocialImage] = useState<{ url: string; source: 'optimized' | 'original' } | null>(null);
  const shareEnabled = plan.source === 'backend' && plan.status === 'active' && plan.features.share;
  const displayedValue = channel === 'social' ? socialDraft : value;

  useEffect(() => {
    if (!editing && channel === 'social') setSocialDraft(value);
  }, [channel, editing, value]);

  useEffect(() => {
    if (!shareEnabled) return;
    void prepareProjectShareImage(projectId, downloadImage || '');
  }, [downloadImage, projectId, shareEnabled]);

  useEffect(() => {
    if (channel !== 'social') return;
    let active = true;
    void projectService.getProjectMedia(projectId).then(state => {
      if (!active) return;
      const selected = state.media.optimized || state.media.original;
      if (!selected) {
        setSocialImage(null);
        return;
      }
      setSocialImage({
        url: getProjectMediaUrl(projectId, selected.id),
        source: state.media.optimized ? 'optimized' : 'original',
      });
    }).catch(() => {
      if (active) setSocialImage(null);
    });
    return () => { active = false; };
  }, [channel, projectId]);

  useEffect(() => {
    if (channel !== 'social') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('publish') === 'resume' && draft?.projectId === projectId) {
      setPublishOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [channel, draft, projectId]);

  async function copy() {
    await navigator.clipboard.writeText(displayedValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function share() {
    if (!shareEnabled || sharing) return;
    setSharing(true);
    setShareMessage('');
    try {
      const outcome = await shareProjectContent({
        projectId,
        title: projectTitle,
        text: displayedValue,
        imageVersion: downloadImage || '',
      });
      if (outcome !== 'cancelled') setShareMessage(shareFeedback(outcome));
    } finally {
      setSharing(false);
    }
  }

  function updateDraft(next: string) {
    if (channel === 'social') setSocialDraft(next);
    else onChange(next);
  }

  return (
    <>
      <article className={`channel-card${channel === 'social' ? ' social-post-card' : ''}`}>
        <header><div><strong>{labels[channel].title}</strong><span>{labels[channel].description}</span></div><span className="channel-ready"><AppIcon name="check" />Bereit</span></header>

        {channel === 'social' && socialImage && (
          <div className="social-card-image">
            <img src={socialImage.url} alt="Projektbild für Social Media" />
            <span>{socialImage.source === 'optimized' ? 'Optimiertes Bild' : 'Originalbild'}</span>
          </div>
        )}

        {editing
          ? <><textarea value={displayedValue} onChange={event => updateDraft(event.target.value)} /><small className="channel-edit-note">{channel === 'social' ? 'Diese Änderung gilt nur für den Veröffentlichungsentwurf.' : 'Änderungen gelten nur lokal bis zum Neuladen der Seite.'}</small></>
          : <p>{displayedValue}</p>}

        <div className={`channel-actions${channel === 'social' ? ' social-channel-actions' : ''}`}>
          {channel === 'social' && <button className="channel-publish-action" type="button" onClick={() => setPublishOpen(true)}><AppIcon name="share" />Veröffentlichen</button>}
          <button type="button" onClick={() => setEditing(current => !current)}><AppIcon name="edit" />{editing ? 'Übernehmen' : 'Bearbeiten'}</button>
          <button type="button" onClick={() => void copy()}><AppIcon name={copied ? 'check' : 'copy'} />{copied ? 'Kopiert' : 'Kopieren'}</button>
          {downloadImage && <a className="channel-download-action" href={downloadImage} download="dfbk-projektbild"><AppIcon name="download" />Bild herunterladen</a>}
          <button className="channel-share-action" type="button" onClick={() => void share()} disabled={!shareEnabled || sharing} title={shareEnabled ? 'Mit dem System-Menü teilen' : 'Teilen ist aktuell nicht verfügbar'}>
            <AppIcon name="share" />{sharing ? 'Öffnet …' : 'Teilen'}
          </button>
        </div>
        {shareMessage && <p className="channel-share-note" role="status">{shareMessage}</p>}
      </article>

      {channel === 'social' && publishOpen && (
        <SocialPublishModal
          projectId={projectId}
          projectTitle={projectTitle}
          initialCaption={displayedValue}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </>
  );
}
