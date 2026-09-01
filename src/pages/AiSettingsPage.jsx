import { useEffect, useState } from "react";
import { PiCheckCircle, PiKey, PiLockKey, PiTrash } from "react-icons/pi";
import { AppHeader } from "../components/AppHeader.jsx";
import { clearServerApiKey, getAiConfig, saveServerApiKey } from "../api/appApi.js";

const MODEL_LABELS = {
  text: "文本模型",
  vision: "图片识别模型",
  tts: "语音生成模型",
};

export function AiSettingsPage() {
  const [config, setConfig] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getAiConfig().then((loaded) => { setConfig(loaded); setConfigured(loaded.server_key_configured); }).catch((requestError) => setError(requestError.message));
  }, []);

  async function saveKey(event) {
    event.preventDefault();
    setError(""); setMessage("");
    try {
      await saveServerApiKey(apiKey.trim());
      setConfigured(true); setApiKey("");
      setMessage("API Key 已保存到 backend/.env，并已在当前后端立即生效。");
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function removeKey() {
    setError(""); setMessage("");
    try {
      await clearServerApiKey(); setConfigured(false); setApiKey("");
      setMessage("backend/.env 中的 API Key 已清除。");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="home-page ai-settings-page">
      <AppHeader />
      <section className="ai-settings-header">
        <p className="flow-eyebrow">PRIVATE BY DESIGN</p>
        <h1>AI 配置</h1>
        <p>模型和接口已锁定。在本机填写一次 Key，后端会保存到自己的环境文件。</p>
      </section>

      <section className="ai-settings-grid">
        <div className="ai-model-list">
          <div className="home-section-heading"><div><h2>当前模型</h2><p>由项目维护者统一配置，用户不可修改</p></div><PiLockKey /></div>
          {config ? Object.entries(config.models).map(([type, model]) => (
            <article className="ai-model-card" key={type}>
              <span>{MODEL_LABELS[type]}</span>
              <strong>{model.name}</strong>
              <p>{model.base_url}</p>
            </article>
          )) : <p className="tts-loading">正在读取模型配置...</p>}
        </div>

        <form className="ai-key-panel" onSubmit={saveKey}>
          <div className="ai-key-title"><PiKey /><div><h2>DashScope API Key</h2><p>同一个 Key 用于文本、图片识别和语音生成。</p></div></div>
          <div className={`ai-key-state${configured ? " is-configured" : ""}`}>
            {configured ? <><PiCheckCircle /><span>后端 API Key 已配置</span></> : <><PiLockKey /><span>后端尚未配置 API Key</span></>}
          </div>
          <label className="ai-key-field">
            <span>API Key</span>
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder="输入你自己的百炼 API Key" aria-describedby="ai-key-help" disabled={!config?.env_setup_available} />
          </label>
          <p id="ai-key-help" className="ai-key-help">保存后会原子更新本机 <code>backend/.env</code>，不会显示实际 Key，也不会提交到 Git。</p>
          <button className="primary-button" type="submit" disabled={!apiKey.trim() || !config?.env_setup_available}>保存到后端环境</button>
          {configured && config?.env_setup_available && <button className="ai-key-clear" type="button" onClick={removeKey}><PiTrash />清除后端 API Key</button>}
          {config && !config.env_setup_available && <p className="ai-server-fallback">为防止远程访客修改服务器配置，此功能只能从运行后端的本机打开。</p>}
          {message && <p className="flow-success" role="status">{message}</p>}
          {error && <p className="flow-error" role="alert">{error}</p>}
        </form>
      </section>

      <section className="ai-public-note"><h2>GitHub 分发方式</h2><p>每位使用者下载并运行自己的前后端，然后在本机页面保存自己的 Key。`backend/.env` 已被 Git 忽略，不会随代码提交。</p></section>
    </main>
  );
}
