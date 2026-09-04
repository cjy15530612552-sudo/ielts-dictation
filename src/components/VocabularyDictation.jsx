import { useEffect, useState } from "react";
import {
  PiArrowCounterClockwise,
  PiArrowLeft,
  PiArrowRight,
  PiCheck,
  PiSpeakerHigh,
} from "react-icons/pi";

export function VocabularyDictation({ words, title, onExit, onPlay, onStop, audioBusy, audioError }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [understoodCount, setUnderstoodCount] = useState(0);
  const currentWord = words[currentIndex];

  function moveNext() {
    onStop();
    if (currentIndex + 1 >= words.length) {
      setCompleted(true);
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setRevealed(false);
    onPlay(words[nextIndex]);
  }

  function chooseUnderstood() {
    if (revealed || completed || audioBusy) return;
    setUnderstoodCount((count) => count + 1);
    moveNext();
  }

  function chooseNotUnderstood() {
    if (revealed || completed || audioBusy) return;
    onStop();
    setRevealed(true);
  }

  function restart() {
    onStop();
    setCurrentIndex(0);
    setRevealed(false);
    setCompleted(false);
    setUnderstoodCount(0);
    onPlay(words[0]);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!completed && !revealed && event.key === "1") {
        event.preventDefault();
        chooseUnderstood();
      } else if (!completed && !revealed && event.key === "2") {
        event.preventDefault();
        chooseNotUnderstood();
      } else if (!completed && revealed && event.key === "Enter") {
        event.preventDefault();
        moveNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (completed) {
    return (
      <section className="vocabulary-dictation-shell is-complete" aria-label="单词听写完成">
        <div className="vocabulary-dictation-complete">
          <span className="dictation-complete-icon"><PiCheck /></span>
          <p className="flow-eyebrow">SESSION COMPLETE</p>
          <h1>本轮听写完成</h1>
          <p>理解 {understoodCount} 个 · 需要复习 {words.length - understoodCount} 个</p>
          <div className="vocabulary-dictation-complete-actions">
            <button className="primary-button" type="button" onClick={restart}><PiArrowCounterClockwise />再来一遍</button>
            <button className="secondary-button" type="button" onClick={onExit}>返回单词本</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="vocabulary-dictation-shell" aria-label={`${title} 单词听写`}>
      <div className="vocabulary-dictation-topbar">
        <button className="text-action" type="button" onClick={onExit}><PiArrowLeft />返回单词本</button>
        <span>{currentIndex + 1} / {words.length}</span>
      </div>

      <div className="vocabulary-dictation-stage">
        <p className="flow-eyebrow">VOCABULARY DICTATION</p>
        {revealed ? (
          <div className="vocabulary-answer-reveal" aria-live="polite">
            <span>这个单词是</span>
            <h1>{currentWord.word}</h1>
            <p>{currentWord.phonetic_uk} · {currentWord.part_of_speech}</p>
          </div>
        ) : (
          <>
            <h1>听一听这个单词</h1>
            <p className="vocabulary-dictation-prompt">根据发音判断你是否理解它。</p>
          </>
        )}

        <button
          className="vocabulary-dictation-replay"
          type="button"
          onClick={() => onPlay(currentWord)}
          disabled={audioBusy}
          aria-label={`再听一次 ${currentWord.word} 发音`}
        >
          <PiSpeakerHigh />
          <span>{audioBusy ? "正在准备发音…" : "再听一次"}</span>
        </button>
        {audioError && <p className="flow-error vocabulary-dictation-error" role="alert">{audioError}</p>}

        {!revealed ? (
          <div className="vocabulary-dictation-choices">
            <button type="button" onClick={chooseUnderstood} disabled={audioBusy}>
              <span>理解</span>
              <small>快捷键：1</small>
            </button>
            <button type="button" onClick={chooseNotUnderstood} disabled={audioBusy}>
              <span>不理解</span>
              <small>快捷键：2</small>
            </button>
          </div>
        ) : (
          <button className="primary-button vocabulary-dictation-next" type="button" onClick={moveNext}>
            {currentIndex + 1 >= words.length ? "完成" : "下一个"}<PiArrowRight />
          </button>
        )}
      </div>
    </section>
  );
}
