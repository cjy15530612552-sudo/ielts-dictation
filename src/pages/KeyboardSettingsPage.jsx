import { useEffect, useState } from "react";
import { PiArrowCounterClockwise, PiKeyboard } from "react-icons/pi";
import { AppHeader } from "../components/AppHeader.jsx";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  assignKeyboardBinding,
  formatKeyCode,
  isBindableKeyboardEvent,
  loadKeyboardBindings,
  storeKeyboardBindings,
} from "../utils/keyboardBindings.js";

const ACTIONS = [
  { id: "advance", label: "切换格子", description: "移动到下一个单词输入格" },
  { id: "submit", label: "检查答案", description: "立即提交并检查当前整句" },
  { id: "replay", label: "重新播放", description: "重听当前句子并保留输入焦点" },
  { id: "stop", label: "停止播放", description: "停止当前正在播放的语音" },
];

export function KeyboardSettingsPage() {
  const [bindings, setBindings] = useState(loadKeyboardBindings);
  const [listeningAction, setListeningAction] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!listeningAction) return undefined;
    function captureKey(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!isBindableKeyboardEvent(event)) {
        setMessage("左右方向键、Backspace 和组合键用于固定输入操作，不能重新绑定。");
        return;
      }
      const result = assignKeyboardBinding(bindings, listeningAction, event.code);
      const saved = storeKeyboardBindings(result.bindings);
      setBindings(saved);
      setListeningAction(null);
      const action = ACTIONS.find((item) => item.id === listeningAction);
      const swapped = ACTIONS.find((item) => item.id === result.swappedAction);
      setMessage(swapped
        ? `${action.label}已设为 ${formatKeyCode(event.code)}，并与${swapped.label}交换键位。`
        : `${action.label}已设为 ${formatKeyCode(event.code)}。`);
    }
    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  }, [bindings, listeningAction]);

  function resetDefaults() {
    const defaults = storeKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS);
    setBindings(defaults);
    setListeningAction(null);
    setMessage("已恢复默认键位。");
  }

  return (
    <main className="home-page keyboard-settings-page">
      <AppHeader />
      <section className="keyboard-settings-header">
        <p className="flow-eyebrow">PERSONAL CONTROLS</p>
        <h1>键位设置</h1>
        <p>点击长方形按键框，再按下想使用的键。设置只保存在当前浏览器中。</p>
      </section>

      <section className="keyboard-settings-panel" aria-label="听写键位">
        <div className="keyboard-settings-title">
          <div><PiKeyboard /><div><h2>听写快捷键</h2><p>当前键位会立即用于所有练习。</p></div></div>
          <button className="secondary-button" type="button" onClick={resetDefaults}><PiArrowCounterClockwise />恢复默认</button>
        </div>
        <div className="keyboard-binding-list">
          {ACTIONS.map((action) => (
            <article className="keyboard-binding-row" key={action.id}>
              <div><h3>{action.label}</h3><p>{action.description}</p></div>
              <button
                className={`keyboard-binding-key${listeningAction === action.id ? " is-listening" : ""}`}
                type="button"
                onClick={() => { setListeningAction(action.id); setMessage(`请按下${action.label}的新键位…`); }}
                aria-label={`${action.label}键位，当前 ${formatKeyCode(bindings[action.id])}`}
                aria-pressed={listeningAction === action.id}
              >
                {listeningAction === action.id ? "请按键…" : formatKeyCode(bindings[action.id])}
              </button>
            </article>
          ))}
        </div>
        {message && <p className="keyboard-settings-message" role="status">{message}</p>}
        <p className="keyboard-fixed-note">固定键位：← / → 在单词内移动光标并在边界跨格；空输入格按 Backspace 返回上一格。</p>
      </section>
    </main>
  );
}
