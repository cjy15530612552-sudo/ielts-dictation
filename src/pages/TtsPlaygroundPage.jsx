import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PiArrowCounterClockwise, PiPause, PiPlay, PiSpeakerHigh, PiTrash } from "react-icons/pi";
import { AppHeader } from "../components/AppHeader.jsx";
import {
  appAssetUrl, deleteTtsVersion, generateTtsVersion, getTtsConfig,
  listTtsSettings, listTtsVersions, saveDefaultTtsSetting,
} from "../api/appApi.js";
import { formatLocalTime } from "../utils/formatLocalTime.js";

const TESTS = [
  ["Test 1 — Part 1 Daily Conversation", "Right, so could you tell me your full name, please?", "part1"],
  ["Test 2 — Part 3 Discussion", "I think we should probably focus on the second option, because it seems more practical.", "part3"],
  ["Test 3 — Part 4 Academic Lecture", "One of the most significant changes occurred during the late nineteenth century.", "part4"],
  ["Test 4 — Numbers", "The total cost is fifteen pounds fifty, and the course starts at ten thirty.", "part1"],
  ["Test 5 — Telephone", "My phone number is zero seven seven zero zero, nine zero zero, one two three.", "part1"],
];

function versionName(index, total) {
  const value = total - index;
  return `Version ${String.fromCharCode(64 + Math.min(value, 26))}`;
}

function AudioVersion({ item, label, onDelete }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setAudioError("Audio playback failed."));
    else audio.pause();
  }

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => setAudioError("Audio playback failed."));
  }

  return (
    <article className="tts-version-card">
      <audio ref={audioRef} src={appAssetUrl(item.audio_url)} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setAudioError("Saved audio is unavailable.")} />
      <div className="tts-version-heading"><div><span>{label}</span><strong>Ready to play</strong></div><button className="tts-delete" onClick={() => onDelete(item.id)} aria-label={`删除 ${label}`}><PiTrash /></button></div>
      <p className="tts-version-text">{item.text}</p>
      {item.speech_text !== item.text && <p className="tts-speech-text"><span>Speech text</span>{item.speech_text}</p>}
      <div className="tts-player-actions">
        <button onClick={toggle}>{playing ? <PiPause /> : <PiPlay />}{playing ? "Pause" : "Play"}</button>
        <button onClick={replay}><PiArrowCounterClockwise />Replay</button>
      </div>
      {audioError && <p className="flow-error">{audioError}</p>}
      <dl className="tts-version-meta">
        <div><dt>Mode</dt><dd>{item.mode}</dd></div><div><dt>Accent</dt><dd>{item.accent}</dd></div>
        <div><dt>Pace</dt><dd>{item.pace}</dd></div><div><dt>Voice</dt><dd>{item.voice}</dd></div>
        <div><dt>Generated</dt><dd>{formatLocalTime(item.created_at)}</dd></div><div><dt>Model</dt><dd>{item.model}</dd></div>
      </dl>
      <details className="tts-instruction-detail"><summary>View instruction</summary><p>{item.instruction}</p></details>
    </article>
  );
}

export function TtsPlaygroundPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const [config, setConfig] = useState(null);
  const [versions, setVersions] = useState([]);
  const [settings, setSettings] = useState([]);
  const [text, setText] = useState(TESTS[0][1]);
  const [mode, setMode] = useState(/^part[1-4]$/.test(requestedMode ?? "") ? requestedMode : "part1");
  const [accent, setAccent] = useState("british");
  const [pace, setPace] = useState("normal");
  const [voice, setVoice] = useState("");
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getTtsConfig(), listTtsVersions(), listTtsSettings()])
      .then(([nextConfig, nextVersions, nextSettings]) => {
        setConfig(nextConfig); setVersions(nextVersions); setSettings(nextSettings);
        const initialMode = nextConfig.modes.some((item) => item.value === requestedMode) ? requestedMode : "part1";
        const saved = nextSettings.find((item) => item.mode === initialMode && item.is_default);
        const initialPreset = nextConfig.modes.find((item) => item.value === initialMode);
        setMode(initialMode); setAccent(saved?.accent ?? "british"); setPace(saved?.pace ?? "normal");
        setVoice(saved?.voice ?? nextConfig.default_voice); setInstruction(saved?.instruction ?? initialPreset.instruction);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  function selectTest(index) {
    setText(TESTS[index][1]); setMode(TESTS[index][2]);
    const preset = config?.modes.find((item) => item.value === TESTS[index][2]);
    if (preset) setInstruction(preset.instruction);
  }

  function changeMode(value) {
    setMode(value);
    setSearchParams({ mode: value }, { replace: true });
    const preset = config.modes.find((item) => item.value === value);
    if (preset) setInstruction(preset.instruction);
  }

  function finalInstruction() {
    const accentText = config.accents.find((item) => item.value === accent)?.instruction ?? "";
    const paceText = config.paces.find((item) => item.value === pace)?.instruction ?? "";
    return [instruction.trim(), accentText, paceText].filter(Boolean).join(" ");
  }

  async function generate() {
    if (generating) return;
    setGenerating(true); setError(""); setMessage("Generating IELTS voice...");
    try {
      const item = await generateTtsVersion({ text, mode, accent, pace, voice: voice || null, custom_instruction: instruction || null });
      setVersions((items) => [item, ...items]); setMessage("Ready to play");
    } catch (requestError) {
      setError(requestError.message); setMessage("");
    } finally { setGenerating(false); }
  }

  async function removeVersion(id) {
    try { await deleteTtsVersion(id); setVersions((items) => items.filter((item) => item.id !== id)); }
    catch (requestError) { setError(requestError.message); }
  }

  async function saveDefault() {
    setError(""); setMessage("");
    try {
      const saved = await saveDefaultTtsSetting({ name: `${config.modes.find((item) => item.value === mode)?.label} Default`, mode, accent, pace, voice: voice || null, instruction: finalInstruction() });
      setSettings((items) => [saved, ...items.filter((item) => item.mode !== saved.mode)]);
      setMessage(`${config.modes.find((item) => item.value === mode)?.label} default saved.`);
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <main className="home-page tts-page">
      <AppHeader />
      <section className="tts-lab-header"><p className="flow-eyebrow">DEVELOPMENT PLAYGROUND</p><h1>IELTS Voice Lab</h1><p>Compare accent, pace, connected speech and delivery without changing the formal dictation workflow.</p></section>
      {!config ? <p className="tts-loading">Loading voice configuration...</p> : <>
        <section className="tts-workspace">
          <div className="tts-form-column">
            <div className="tts-test-tabs" aria-label="预置测试文本">{TESTS.map(([label], index) => <button key={label} onClick={() => selectTest(index)}>{label.replace(/ — .*/, "")}</button>)}</div>
            <label className="tts-field tts-field-wide"><span>Test text</span><textarea value={text} onChange={(event) => setText(event.target.value)} rows="4" maxLength="600" /></label>
            <div className="tts-control-grid">
              <label className="tts-field"><span>IELTS Mode</span><select value={mode} onChange={(event) => changeMode(event.target.value)}>{config.modes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label className="tts-field"><span>Accent</span><select value={accent} onChange={(event) => setAccent(event.target.value)}>{config.accents.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label className="tts-field"><span>Speech Pace</span><select value={pace} onChange={(event) => setPace(event.target.value)}>{config.paces.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label className="tts-field"><span>Voice</span><select value={voice} onChange={(event) => setVoice(event.target.value)}>{config.voices.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><small>Official Plus system voices only</small></label>
            </div>
            <label className="tts-field tts-field-wide"><span>Instruction</span><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows="7" maxLength="1600" /></label>
            <div className="tts-form-actions"><button className="primary-button" disabled={generating || !text.trim()} onClick={generate}><PiSpeakerHigh />{generating ? "Generating IELTS voice..." : "生成试听"}</button><button className="secondary-button" disabled={generating} onClick={saveDefault}>保存为当前 IELTS 默认配置</button></div>
            {message && <p className="tts-status" role="status">{message}</p>}{error && <p className="flow-error" role="alert">{error}</p>}
          </div>
          <aside className="tts-lab-note"><span>Active model</span><strong>{config.model}</strong><p>Accent and pace are sent as natural-language instruction. Pace also maps to the official rate parameter: 0.9 / 1.0 / 1.1.</p><p>No voice cloning or official IELTS speaker audio is used.</p>{settings.length > 0 && <div><span>Saved defaults</span>{settings.map((item) => <b key={item.id}>{item.mode} · {item.voice}</b>)}</div>}</aside>
        </section>
        <section className="tts-history"><div className="home-section-heading"><div><h2>历史试听版本</h2><p>{versions.length} versions · playback never regenerates audio</p></div></div>{versions.length === 0 ? <div className="home-empty compact"><h3>No voice versions yet</h3><p>Generate the first IELTS voice sample above.</p></div> : <div className="tts-version-list">{versions.map((item, index) => <AudioVersion key={item.id} item={item} label={versionName(index, versions.length)} onDelete={removeVersion} />)}</div>}</section>
      </>}
    </main>
  );
}
