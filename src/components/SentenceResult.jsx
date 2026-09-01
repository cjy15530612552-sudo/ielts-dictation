import { PiArrowCounterClockwise, PiArrowLeft, PiArrowRight } from "react-icons/pi";

export function SentenceResult({ result, slotWidths, onPrevious, onReplay, onNext, onWordClick, isFirst = false, isLast = false }) {
  const accuracy = Math.round((result.correctCount / result.aligned.length) * 100);

  return (
    <section className="result-panel" aria-live="polite" aria-label="听写结果">
      <div className="result-words">
        {result.aligned.map((item, index) => (
          <div
            className={`result-word is-${item.type}`}
            style={{ "--slot-width": `${slotWidths[index]}px` }}
            key={`${item.expected}-${index}`}
          >
            <button className="result-entered" type="button" onClick={() => onWordClick?.(item.expected)}>{item.entered || item.expected}</button>
            <div className="result-correct">
              {item.type === "wrong" ? item.expected : item.type === "missing" ? "漏写" : "正确"}
            </div>
            <div className="result-status" aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="result-summary">
        <p className="accuracy">Accuracy {accuracy}%</p>
        <p className="missed-count">{result.issueCount} words missed</p>
        {result.extras.length > 0 && (
          <p className="extra-words">多余单词：{result.extras.join(" · ")}</p>
        )}
        <div className="result-actions">
          <button className="text-action" type="button" onClick={onPrevious} disabled={isFirst}>
            <PiArrowLeft aria-hidden="true" />
            <span>上一句</span>
          </button>
          <button className="text-action" type="button" onClick={onReplay}>
            <PiArrowCounterClockwise aria-hidden="true" />
            <span>再听一次</span>
          </button>
          <button className="primary-button" type="button" onClick={onNext}>
            <span>{isLast ? "完成练习" : "下一句"}</span>
            <PiArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
