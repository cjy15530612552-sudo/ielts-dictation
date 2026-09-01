export function ProgressIndicator({ current, total }) {
  return (
    <div className="progress-indicator" aria-label={`第 ${current} 句，共 ${total} 句`}>
      {current} / {total}
    </div>
  );
}
