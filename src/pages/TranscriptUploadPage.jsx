import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PiArrowLeft,
  PiArrowRight,
  PiDotsSixVertical,
  PiImageSquare,
  PiTrash,
  PiUploadSimple,
  PiGear,
  PiPause,
  PiSpeakerHigh,
} from "react-icons/pi";
import { FlowHeader } from "../components/FlowHeader.jsx";
import { analyzeTranscript, uploadTranscriptImages } from "../api/transcriptApi.js";
import {
  appAssetUrl, createPractice, deletePractice, generateTtsVersion, listTtsSettings,
} from "../api/appApi.js";
import { getClipboardImageFiles } from "../utils/clipboardImages.js";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const MAX_FILES = 6;
const PARTS = [
  ["part1", "Part 1 Conversation"],
  ["part2", "Part 2 Monologue"],
  ["part3", "Part 3 Discussion"],
  ["part4", "Part 4 Academic Lecture"],
];
const PART_PREVIEW_TEXT = {
  part1: "Right, so could you tell me your full name, please?",
  part2: "Now, I'd like to tell you about the facilities available in the local area.",
  part3: "I think we should probably focus on the second option, because it seems more practical.",
  part4: "One of the most significant changes occurred during the late nineteenth century.",
};

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function TranscriptUploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const previewAudioRef = useRef(null);
  const [items, setItems] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("idle");
  const [practiceName, setPracticeName] = useState("");
  const [part, setPart] = useState("part1");
  const [ttsPreviewUrls, setTtsPreviewUrls] = useState({});
  const [ttsPreviewStatus, setTtsPreviewStatus] = useState("idle");
  const [ttsPreviewError, setTtsPreviewError] = useState("");

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewAudioRef.current?.pause();
  }, []);

  function playPreviewUrl(url) {
    previewAudioRef.current?.pause();
    const audio = new Audio(appAssetUrl(url));
    previewAudioRef.current = audio;
    audio.addEventListener("play", () => setTtsPreviewStatus("playing"));
    audio.addEventListener("pause", () => setTtsPreviewStatus("ready"));
    audio.addEventListener("ended", () => setTtsPreviewStatus("ready"));
    audio.addEventListener("error", () => { setTtsPreviewStatus("idle"); setTtsPreviewError("试听音频无法播放，请到语音设置中重试。"); });
    audio.play().catch(() => { setTtsPreviewStatus("idle"); setTtsPreviewError("浏览器未能开始播放试听音频。"); });
  }

  async function previewPartVoice() {
    if (ttsPreviewStatus === "generating") return;
    if (ttsPreviewStatus === "playing") {
      previewAudioRef.current?.pause();
      return;
    }
    setTtsPreviewError("");
    if (ttsPreviewUrls[part]) {
      playPreviewUrl(ttsPreviewUrls[part]);
      return;
    }
    setTtsPreviewStatus("generating");
    try {
      const settings = await listTtsSettings();
      const saved = settings.find((item) => item.mode === part && item.is_default);
      const generated = await generateTtsVersion({
        text: PART_PREVIEW_TEXT[part],
        mode: part,
        accent: saved?.accent ?? "british",
        pace: saved?.pace ?? "normal",
        voice: saved?.voice ?? null,
        custom_instruction: saved?.instruction ?? null,
      });
      setTtsPreviewUrls((current) => ({ ...current, [part]: generated.audio_url }));
      playPreviewUrl(generated.audio_url);
    } catch (requestError) {
      setTtsPreviewStatus("idle");
      setTtsPreviewError(requestError.message || "试听生成失败，请检查语音配置。");
    }
  }

  function changePart(value) {
    previewAudioRef.current?.pause();
    setPart(value);
    setTtsPreviewStatus(ttsPreviewUrls[value] ? "ready" : "idle");
    setTtsPreviewError("");
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) return;
    const invalid = incoming.find(
      (file) => !ACCEPTED_TYPES.has(file.type) || !ACCEPTED_EXTENSIONS.test(file.name),
    );
    if (invalid) {
      setError(`不支持的文件：${invalid.name}。请选择 JPG、JPEG、PNG 或 WebP。`);
      return;
    }

    setItems((current) => {
      const existingKeys = new Set(current.map((item) => fileKey(item.file)));
      const unique = incoming.filter((file) => !existingKeys.has(fileKey(file)));
      if (current.length + unique.length > MAX_FILES) {
        setError("每次最多上传 6 张图片");
        return current;
      }
      const added = unique.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        return { id: crypto.randomUUID(), file, previewUrl };
      });
      setError("");
      return [...current, ...added];
    });
  }

  function removeItem(id) {
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    setError("");
  }

  function moveItem(id, offset) {
    setItems((current) => {
      const from = current.findIndex((item) => item.id === id);
      const to = Math.max(0, Math.min(from + offset, current.length - 1));
      if (from < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function reorderItem(sourceId, targetId) {
    if (!sourceId || sourceId === targetId) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.id === sourceId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  function handlePaste(event) {
    if (isBusy) return;
    const clipboardFiles = getClipboardImageFiles(event.clipboardData);
    if (clipboardFiles.length === 0) {
      setError("剪贴板中没有可上传的图片，请先复制一张 JPG、PNG 或 WebP 图片。");
      return;
    }
    event.preventDefault();
    addFiles(clipboardFiles);
  }

  async function startRecognition() {
    if (items.length === 0 || !practiceName.trim() || phase !== "idle") return;
    setError("");
    let practice = null;
    try {
      setPhase("uploading");
      practice = await createPractice(practiceName.trim(), part);
      const session = await uploadTranscriptImages(items.map((item) => item.file), practice.id);
      setPhase("analyzing");
      await analyzeTranscript(session.session_id);
      navigate(`/transcript/${session.session_id}/review`);
    } catch (requestError) {
      if (practice?.id) await deletePractice(practice.id).catch(() => {});
      setError(requestError.message || "识别失败，请稍后重试");
      setPhase("idle");
    }
  }

  const isBusy = phase !== "idle";
  const actionLabel = phase === "uploading"
    ? "正在上传..."
    : phase === "analyzing"
      ? "千问正在识别..."
      : "开始识别";

  return (
    <main className="flow-page upload-page">
      <FlowHeader trailing={<span className="flow-step">上传与识别</span>} />

      <section className="flow-content upload-content">
        <div className="flow-intro">
          <p className="flow-eyebrow">IMPORT TRANSCRIPT</p>
          <h1>上传 IELTS 原文截图</h1>
          <p>按原文顺序上传 1–6 张连续截图，千问将把它们识别为同一篇 Listening transcript。</p>
        </div>

        <label className="practice-name-field">
          <span>练习名称</span>
          <input value={practiceName} onChange={(event) => setPracticeName(event.target.value)} maxLength="160" placeholder="例如：剑雅18 Test 1 Part 4" autoFocus />
          <small>名称会显示在首页和单词来源中。</small>
        </label>

        <div className="practice-part-row">
          <label className="practice-part-field">
            <span>Part</span>
            <select value={part} onChange={(event) => changePart(event.target.value)} aria-label="Part">
              {PARTS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <button className="part-preview-button" type="button" onClick={previewPartVoice} disabled={ttsPreviewStatus === "generating"} aria-label={`试听 ${PARTS.find(([value]) => value === part)?.[1]}`}>
            {ttsPreviewStatus === "playing" ? <PiPause /> : <PiSpeakerHigh />}
            <span>{ttsPreviewStatus === "generating" ? "生成中..." : ttsPreviewStatus === "playing" ? "暂停" : "试听"}</span>
          </button>
          <button className="part-settings-button" type="button" onClick={() => navigate(`/tts-playground?mode=${part}`)} aria-label={`设置 ${PARTS.find(([value]) => value === part)?.[1]} 语音`}>
            <PiGear /><span>设置</span>
          </button>
        </div>
        <p className="practice-part-help">选择后会关联对应 IELTS Mode。首次试听会生成并保存一个 Playground 版本。</p>
        {ttsPreviewError && <p className="flow-error part-preview-error" role="alert">{ttsPreviewError}</p>}

        <div
          className={`upload-dropzone${isDraggingFiles ? " is-dragging" : ""}`}
          role="region"
          aria-label="上传截图区域，可拖拽、选择或粘贴图片"
          tabIndex={isBusy ? -1 : 0}
          onClick={(event) => {
            if (!event.target.closest("button, input")) event.currentTarget.focus();
          }}
          onDragEnter={(event) => { event.preventDefault(); setIsDraggingFiles(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingFiles(false);
          }}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          <PiImageSquare aria-hidden="true" />
          <p>拖拽截图到这里</p>
          <span>点击此区域后按 Ctrl+V 粘贴，或</span>
          <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
            <PiUploadSimple aria-hidden="true" />
            选择图片
          </button>
          <small>JPG、JPEG、PNG、WebP · 每次最多 6 张</small>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            aria-label="选择 IELTS 原文截图"
          />
        </div>

        {error && <p className="flow-error" role="alert">{error}</p>}

        {items.length > 0 && (
          <section className="upload-selection" aria-label="已选择图片">
            <div className="selection-heading">
              <div>
                <h2>图片顺序</h2>
                <p>拖动缩略图调整顺序，发送给模型时将严格按 1 → {items.length} 处理。</p>
              </div>
              <span>{items.length} / {MAX_FILES}</span>
            </div>

            <div className="thumbnail-grid">
              {items.map((item, index) => (
                <article
                  className={`thumbnail-item${draggedId === item.id ? " is-dragging" : ""}`}
                  key={item.id}
                  draggable={!isBusy}
                  onDragStart={(event) => {
                    setDraggedId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => {
                    if (draggedId) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!draggedId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    reorderItem(event.dataTransfer.getData("text/plain") || draggedId, item.id);
                    setDraggedId(null);
                  }}
                >
                  <div className="thumbnail-preview">
                    <img src={item.previewUrl} alt={`第 ${index + 1} 张：${item.file.name}`} />
                    <span className="thumbnail-order">{index + 1}</span>
                    <PiDotsSixVertical className="thumbnail-drag-handle" aria-hidden="true" />
                  </div>
                  <div className="thumbnail-meta">
                    <p title={item.file.name}>{item.file.name}</p>
                    <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="thumbnail-actions">
                    <button
                      type="button"
                      onClick={() => moveItem(item.id, -1)}
                      disabled={index === 0 || isBusy}
                      aria-label={`将 ${item.file.name} 向前移动`}
                    ><PiArrowLeft /></button>
                    <button
                      type="button"
                      onClick={() => moveItem(item.id, 1)}
                      disabled={index === items.length - 1 || isBusy}
                      aria-label={`将 ${item.file.name} 向后移动`}
                    ><PiArrowRight /></button>
                    <button
                      type="button"
                      className="thumbnail-delete"
                      onClick={() => removeItem(item.id)}
                      disabled={isBusy}
                      aria-label={`删除 ${item.file.name}`}
                    ><PiTrash /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="flow-actions upload-actions">
          <button
            className="primary-button"
            type="button"
            disabled={items.length === 0 || !practiceName.trim() || isBusy}
            onClick={startRecognition}
          >
            {isBusy && <span className="button-spinner" aria-hidden="true" />}
            {actionLabel}
          </button>
          {phase === "analyzing" && (
            <p aria-live="polite">正在按图片顺序提取原文，这可能需要几十秒。</p>
          )}
        </div>
      </section>
    </main>
  );
}
