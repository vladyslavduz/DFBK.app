import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';
import { useUserArea, type ContentChannel } from '../contexts/UserAreaContext';
import { prepareProjectShareImage, shareProjectContent, type ShareOutcome } from '../services/share';

const labels: Record<ContentChannel, { title: string; description: string }> = {
  google: { title: 'Google Business', description: 'Für dein Google Business Profil' },
  social: { title: 'Social Media', description: 'Für Instagram, Facebook und weitere Kanäle' },
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
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const shareEnabled = plan.source === 'backend' && plan.status === 'active' && plan.features.share;

  useEffect(() => {
    if (!shareEnabled) return;
    void prepareProjectShareImage(projectId, downloadImage || '');
  }, [downloadImage, projectId, shareEnabled]);

  async function copy() {
    await navigator.clipboard.writeText(value);
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
        text: value,
        imageVersion: downloadImage || '',
      });
      if (outcome !== 'cancelled') setShareMessage(shareFeedback(outcome));
    } finally {
      setSharing(false);
    }
  }

  return (
    <article className="channel-card">
      <header><div><strong>{labels[channel].title}</strong><span>{labels[channel].description}</span></div><span className="channel-ready"><AppIcon name="check" />Bereit</span></header>
      {editing ? <><textarea value={value} onChange={event => onChange(event.target.value)} /><small className="channel-edit-note">Änderungen gelten nur lokal bis zum Neuladen der Seite.</small></> : <p>{value}</p>}
      <div className="channel-actions">
        <button type="button" onClick={copy}><AppIcon name={copied ? 'check' : 'copy'} />{copied ? 'Kopiert' : 'Kopieren'}</button>
        <button type="button" onClick={() => setEditing(current => !current)}><AppIcon name="edit" />{editing ? 'Lokal übernehmen' : 'Bearbeiten'}</button>
        <button className="channel-share-action" type="button" onClick={() => void share()} disabled={!shareEnabled || sharing} title={shareEnabled ? 'Mit dem System-Menü teilen' : 'Teilen ist im Business-Tarif verfügbar'}>
          <AppIcon name="share" />{sharing ? 'Öffnet …' : shareEnabled ? 'Teilen' : 'Teilen · Business'}
        </button>
        {downloadImage && <a className="channel-download-action" href={downloadImage} download="dfbk-projektbild"><AppIcon name="download" />Bild herunterladen</a>}
      </div>
      {shareMessage && <p className="channel-share-note" role="status">{shareMessage}</p>}
    </article>
  );
}
