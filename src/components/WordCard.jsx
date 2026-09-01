import { useEffect, useRef, useState } from "react";
import { PiStar, PiStarFill, PiX } from "react-icons/pi";
import { addFavorite, deleteFavorite, explainWord, listVocabulary } from "../api/appApi.js";

export function WordCard({ word, sentence, practiceId, onClose, initialExplanation = null, onFavoriteChange }) {
  const cardRef = useRef(null);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [favorite, setFavorite] = useState(null);
  const [status, setStatus] = useState(initialExplanation ? "ready" : "loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = initialExplanation ?? await explainWord(word, sentence);
        const items = await listVocabulary();
        if (cancelled) return;
        setExplanation(result);
        setFavorite(items.find((item) => item.lemma.toLowerCase() === result.lemma.toLowerCase() && item.meaning_zh === result.meaning_zh) ?? null);
        setStatus("ready");
      } catch (requestError) {
        if (!cancelled) { setError(requestError.message); setStatus("error"); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [word, sentence, initialExplanation]);

  async function toggleFavorite() {
    if (!explanation) return;
    try {
      if (favorite) {
        await deleteFavorite(favorite.id);
        setFavorite(null);
        setMessage("已从单词本移除");
      } else {
        const response = await addFavorite({ ...explanation, source_sentence: sentence, practice_id: practiceId || null });
        setFavorite(response.item);
        setMessage(response.created ? "已加入单词本" : "已收藏相同语境");
      }
      onFavoriteChange?.();
      window.setTimeout(() => setMessage(""), 1800);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <aside className="word-card" ref={cardRef} role="dialog" aria-label={`${word} 单词解释`}>
      <button className="word-card-close" type="button" onClick={onClose} aria-label="关闭单词卡"><PiX /></button>
      {status === "loading" && <p className="word-card-loading">正在查询当前语境释义…</p>}
      {error && <p className="word-card-error">{error}</p>}
      {explanation && (
        <>
          <div className="word-card-title">
            <h2>{explanation.word}</h2>
            <button type="button" onClick={toggleFavorite} aria-label={favorite ? "取消收藏" : "收藏单词"}>
              {favorite ? <PiStarFill /> : <PiStar />}
            </button>
          </div>
          <p className="word-phonetic">{explanation.phonetic_uk}</p>
          <p className="word-pos">{explanation.part_of_speech}</p>
          <p className="word-meaning">{explanation.meaning_zh}</p>
          <div className="word-context"><span>当前语境</span><p>{explanation.meaning_in_context}</p></div>
          {message && <p className="word-card-toast" role="status">{message}</p>}
        </>
      )}
    </aside>
  );
}
