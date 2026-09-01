const WORD_PATTERN = /([A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*)/g;
const IS_WORD = /^[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*$/;

export function ClickableTranscript({ text, onWordClick }) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  return (
    <div className="clickable-transcript">
      {sentences.map((sentence, sentenceIndex) => (
        <p key={`${sentence.slice(0, 20)}-${sentenceIndex}`}>
          {sentence.split(WORD_PATTERN).map((part, index) => IS_WORD.test(part)
            ? <button type="button" key={`${part}-${index}`} onClick={() => onWordClick(part, sentence)}>{part}</button>
            : <span key={`${part}-${index}`}>{part}</span>)}
        </p>
      ))}
    </div>
  );
}
