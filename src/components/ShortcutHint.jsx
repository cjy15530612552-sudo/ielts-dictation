export function ShortcutHint({ shortcut, label }) {
  return (
    <span className="shortcut-hint">
      <kbd className="shortcut-key">{shortcut}</kbd>
      <span>{label}</span>
    </span>
  );
}
