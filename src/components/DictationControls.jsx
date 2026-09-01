import { PiArrowCounterClockwise } from "react-icons/pi";
import { ShortcutHint } from "./ShortcutHint.jsx";

export function DictationControls({ onReplay, onSubmit }) {
  return (
    <div className="dictation-controls">
      <div className="replay-line">
        <button className="text-action" type="button" onClick={onReplay}>
          <PiArrowCounterClockwise aria-hidden="true" />
          <span>重新播放</span>
        </button>
        <ShortcutHint shortcut="Tab" label="重播" />
      </div>
      <button className="primary-button" type="button" onClick={onSubmit}>检查答案</button>
    </div>
  );
}
