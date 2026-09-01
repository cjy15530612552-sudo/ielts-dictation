import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PiBracketsCurly, PiCheck, PiWarningCircle } from "react-icons/pi";
import { FlowHeader } from "../components/FlowHeader.jsx";
import { ClickableTranscript } from "../components/ClickableTranscript.jsx";
import { WordCard } from "../components/WordCard.jsx";
import {
  confirmTranscript,
  getTranscriptSession,
  transcriptAssetUrl,
} from "../api/transcriptApi.js";

export function TranscriptReviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [generationFailed, setGenerationFailed] = useState(false);
  const [lookup, setLookup] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const loaded = await getTranscriptSession(sessionId);
        if (cancelled) return;
        setSession(loaded);
        if (loaded.transcript) setDraft(structuredClone(loaded.transcript));
        else setError(loaded.error || "当前 session 尚无可校对的识别结果");
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || "无法读取识别结果");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  const jsonPreview = useMemo(() => draft ? JSON.stringify(draft, null, 2) : "", [draft]);

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
    setGenerationFailed(false);
  }

  function updateSegment(index, field, value) {
    setDraft((current) => {
      const segments = current.segments.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, [field]: value } : segment,
      );
      return { ...current, segments };
    });
    setSavedMessage("");
    setGenerationFailed(false);
  }

  async function saveConfirmedTranscript() {
    if (!draft || isSaving) return;
    if (!draft.full_text.trim()) {
      setError("确认前请保留有效的英文 transcript");
      return;
    }
    setIsSaving(true);
    setError("");
    setGenerationFailed(false);
    try {
      const updated = await confirmTranscript(sessionId, draft);
      setSession(updated);
      setDraft(structuredClone(updated.transcript));
      setSavedMessage("原文和逐句语音已保存。");
      navigate("/", { replace: true, state: { created: true } });
    } catch (requestError) {
      setGenerationFailed(true);
      setError(`音频未全部生成：${requestError.message || "生成失败"}。请点击下方按钮重试。`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flow-page review-page">
      <FlowHeader
        backTo="/import"
        backLabel="返回修改图片"
        trailing={<span className={`session-status is-${session?.status ?? "loading"}`}>
          {session?.status === "confirmed" ? "已确认" : "检查识别结果"}
        </span>}
      />

      <section className="flow-content review-content">
        <div className="flow-intro review-intro">
          <p className="flow-eyebrow">REVIEW TRANSCRIPT</p>
          <h1>检查识别结果</h1>
          <p>AI 识别可能存在错误，请重点核对数字、人名、地名、金额、邮编和标点。</p>
        </div>

        {isLoading && <div className="flow-loading"><span className="button-spinner" />正在读取模型结果...</div>}
        {error && <p className="flow-error" role="alert">{error}</p>}
        {savedMessage && <p className="flow-success" role="status"><PiCheck />{savedMessage}</p>}

        {session?.images?.length > 0 && (
          <section className="source-strip" aria-label="识别来源图片">
            <div className="source-strip-heading">
              <h2>识别来源</h2>
              <span>{session.images.length} 张连续截图</span>
            </div>
            <div className="source-strip-images">
              {session.images.map((image) => (
                <figure key={image.id}>
                  <img src={transcriptAssetUrl(image.url)} alt={`第 ${image.order} 张：${image.original_name}`} />
                  <figcaption>{image.order}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {draft && (
          <div className="review-workspace">
            <section className="transcript-editor">
              <div className="editor-heading">
                <div>
                  <h2>可编辑 Transcript</h2>
                  <p>这里的内容将作为确认后的标准原文保存。</p>
                </div>
                <span>{draft.full_text.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>

              <div className="editor-meta-grid">
                <label>
                  <span>标题</span>
                  <input
                    value={draft.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder="未识别到标题"
                  />
                </label>
                <label>
                  <span>内容类型</span>
                  <select value={draft.type} onChange={(event) => updateField("type", event.target.value)}>
                    <option value="dialogue">Dialogue</option>
                    <option value="monologue">Monologue</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
              </div>

              <label className="full-text-editor">
                <span>完整英文原文</span>
                <textarea
                  value={draft.full_text}
                  onChange={(event) => updateField("full_text", event.target.value)}
                  spellCheck="false"
                  rows="16"
                />
              </label>

              <details className="transcript-lookup-panel" open>
                <summary>点击原文单词查询释义</summary>
                <ClickableTranscript text={draft.full_text} onWordClick={(word, sentence) => setLookup({ word, sentence })} />
              </details>

              {draft.segments.length > 0 && (
                <details className="segment-editor" open>
                  <summary>结构化段落 · {draft.segments.length}</summary>
                  <p className="segment-help">Speaker 标签不会被当作朗读文本。修改段落不会自动覆盖上方完整原文。</p>
                  <div className="segment-list">
                    {draft.segments.map((segment, index) => (
                      <article className="segment-item" key={segment.id}>
                        <div className="segment-number">{String(index + 1).padStart(2, "0")}</div>
                        <div className="segment-fields">
                          <label>
                            <span>Speaker</span>
                            <input
                              value={segment.speaker}
                              onChange={(event) => updateSegment(index, "speaker", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Text</span>
                            <textarea
                              value={segment.text}
                              onChange={(event) => updateSegment(index, "text", event.target.value)}
                              spellCheck="false"
                              rows="3"
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
              )}
            </section>

            <aside className="review-sidebar">
              <section className="review-panel">
                <h2>识别概览</h2>
                <dl>
                  <div><dt>类型</dt><dd>{draft.type}</dd></div>
                  <div><dt>Speakers</dt><dd>{draft.speakers.length}</dd></div>
                  <div><dt>Segments</dt><dd>{draft.segments.length}</dd></div>
                  <div><dt>不确定词</dt><dd>{draft.uncertain_tokens.length}</dd></div>
                </dl>
              </section>

              {draft.uncertain_tokens.length > 0 && (
                <section className="review-panel uncertainty-panel">
                  <h2><PiWarningCircle />需要重点核对</h2>
                  <ul>
                    {draft.uncertain_tokens.map((item, index) => (
                      <li key={`${item.token}-${index}`}>
                        <strong>{item.token}</strong>
                        <span>{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <details className="json-panel review-panel">
                <summary><PiBracketsCurly />查看模型 JSON</summary>
                <pre>{jsonPreview}</pre>
              </details>
            </aside>
          </div>
        )}

        {draft && (
          <div className="review-footer-actions">
            <Link className="text-action" to="/import">返回修改图片</Link>
            <div className="review-generation-action">
              <small>{isSaving ? `正在批量生成 ${draft.segments.length} 句语音，全部完成后才可进入练习。` : "系统会先确认全部句子音频可用，再开放练习。"}</small>
              <button className="primary-button" type="button" onClick={saveConfirmedTranscript} disabled={isSaving}>
                {isSaving && <span className="button-spinner" aria-hidden="true" />}
                {isSaving ? `正在生成 ${draft.segments.length} 句语音...` : generationFailed ? "重试生成全部语音" : session?.status === "confirmed" ? "保存修改并更新语音" : "确认原文并生成语音"}
              </button>
            </div>
          </div>
        )}
      </section>
      {lookup && <WordCard word={lookup.word} sentence={lookup.sentence} practiceId={session?.practice_id} onClose={() => setLookup(null)} />}
    </main>
  );
}
