import { WordInput } from "./WordInput.jsx";

export function WordInputRow({
  tokens,
  answers,
  currentWordIndex,
  inputRefs,
  slotWidths,
  disabled,
  onAnswerChange,
  onFocusWord,
  onMove,
  onSpace,
  onSubmit,
  onReplay,
  onStop,
}) {
  return (
    <div className="word-input-row" aria-label={`听写区域，共 ${tokens.length} 个单词`}>
      {tokens.map((_, index) => (
        <WordInput
          key={index}
          index={index}
          value={answers[index] ?? ""}
          width={slotWidths[index]}
          active={currentWordIndex === index}
          disabled={disabled}
          inputRef={(node) => { inputRefs.current[index] = node; }}
          onChange={(value) => onAnswerChange(index, value)}
          onFocus={() => onFocusWord(index)}
          onMove={onMove}
          onSpace={onSpace}
          onSubmit={(submittedIndex) => submittedIndex === tokens.length - 1 ? onSubmit() : onMove(1)}
          onReplay={onReplay}
          onStop={onStop}
        />
      ))}
    </div>
  );
}
