import { useState } from 'react';
import AppIcon from './AppIcon';
import type { ContentChannel } from '../contexts/UserAreaContext';

const labels: Record<ContentChannel, { title: string; description: string }> = {
  google: { title: 'Google', description: 'Für dein Google Business Profil' },
  social: { title: 'Social Media', description: 'Für Instagram, Facebook und weitere Kanäle' },
  website: { title: 'Website', description: 'Für Referenzen und Projektseiten' },
};

type Props = { channel: ContentChannel; value: string; onChange: (value: string) => void };

export default function ChannelCard({ channel, value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="channel-card">
      <header><div><strong>{labels[channel].title}</strong><span>{labels[channel].description}</span></div><span className="channel-ready"><AppIcon name="check" />Bereit</span></header>
      {editing ? <textarea value={value} onChange={event => onChange(event.target.value)} /> : <p>{value}</p>}
      <div className="channel-actions"><button type="button" onClick={copy}><AppIcon name={copied ? 'check' : 'copy'} />{copied ? 'Kopiert' : 'Kopieren'}</button><button type="button" onClick={() => setEditing(current => !current)}><AppIcon name="edit" />{editing ? 'Speichern' : 'Bearbeiten'}</button></div>
    </article>
  );
}
