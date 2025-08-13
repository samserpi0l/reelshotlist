// pages/_offline.js
export default function Offline() {
  return (
    <div className="container" style={{ padding: 24 }}>
      <h1>Offline</h1>
      <p className="muted">
        Du bist gerade offline. Inhalte, die du bereits besucht hast, stehen weiterhin zur Verfügung.
        Bitte prüfe deine Verbindung und versuche es erneut.
      </p>
      <a href="/" className="primary" style={{ display: 'inline-block', marginTop: 12 }}>
        Zur Startseite
      </a>
    </div>
  );
}
