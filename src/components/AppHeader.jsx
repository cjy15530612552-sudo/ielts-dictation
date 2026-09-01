import { NavLink } from "react-router-dom";
import { PiKeyboard, PiPlus } from "react-icons/pi";

export function AppHeader() {
  return (
    <header className="app-header">
      <NavLink className="app-logo" to="/">IELTS Dictation<span>逐句精听</span></NavLink>
      <nav aria-label="主导航">
        <NavLink to="/" end>首页</NavLink>
        <NavLink to="/vocabulary">单词本</NavLink>
        <NavLink to="/tts-playground">语音调试</NavLink>
        <NavLink className="ai-config-link" to="/ai-settings">AI 配置</NavLink>
        <NavLink className="keyboard-settings-link" to="/keyboard-settings"><PiKeyboard /><span>键位设置</span></NavLink>
        <NavLink className="new-practice-link" to="/practice/new"><PiPlus />新建练习</NavLink>
      </nav>
    </header>
  );
}
