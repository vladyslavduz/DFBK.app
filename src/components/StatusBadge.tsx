export default function StatusBadge({ enabled }: { enabled: boolean }) {
  return <span className={`status-badge ${enabled ? 'status-enabled' : 'status-disabled'}`}>{enabled ? 'Bereit' : 'Noch nicht verbunden'}</span>;
}
