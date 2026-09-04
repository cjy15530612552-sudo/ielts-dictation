export function WordInput({
  value,
  index,
  width,
  active,
  disabled,
  inputRef,
  onChange,
  onFocus,
  onMove,
  onInsertGap,
  onRemoveGap,
  onMoveVertical,
  onSubmit,
  onReplay,
  onStop,
  bindings,
}) {
  function handleKeyDown(event) {
    const { selectionStart, selectionEnd } = event.currentTarget;
    const hasSelection = selectionStart !== selectionEnd;
    const isPlainArrow = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

    if (event.code === bindings.advance) {
      event.preventDefault();
      onInsertGap(index);
    } else if (event.key === "ArrowLeft" && isPlainArrow && !hasSelection && selectionStart === 0) {
      event.preventDefault();
      onMove(-1, "end");
    } else if (event.key === "ArrowRight" && isPlainArrow && !hasSelection && selectionEnd === value.length) {
      event.preventDefault();
      onMove(1, "start");
    } else if (event.key === "ArrowUp" && isPlainArrow) {
      event.preventDefault();
      onMoveVertical(index, -1);
    } else if (event.key === "ArrowDown" && isPlainArrow) {
      event.preventDefault();
      onMoveVertical(index, 1);
    } else if (event.key === "Backspace" && value.length === 0) {
      event.preventDefault();
      if (!onRemoveGap(index)) onMove(-1, "end");
    } else if (event.code === bindings.replay) {
      event.preventDefault();
      event.stopPropagation();
      onReplay();
    } else if (event.code === bindings.submit) {
      event.preventDefault();
      onSubmit(index);
    } else if (event.code === bindings.stop) {
      event.preventDefault();
      event.stopPropagation();
      onStop();
    }
  }

  return (
    <div className="word-input-wrap" style={{ "--slot-width": `${width}px` }}>
      <input
        ref={inputRef}
        className={`word-input${active ? " is-active" : ""}`}
        type="text"
        value={value}
        aria-label={`第 ${index + 1} 个单词`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value.replace(/\s+/g, ""))}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
