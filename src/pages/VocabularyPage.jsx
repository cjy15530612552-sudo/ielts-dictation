import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PiStarFill, PiTrash } from "react-icons/pi";
import { deleteFavorite, getPractice, listVocabulary } from "../api/appApi.js";
import { AppHeader } from "../components/AppHeader.jsx";
import { WordCard } from "../components/WordCard.jsx";
import { formatLocalTime } from "../utils/formatLocalTime.js";

export function VocabularyPage() {
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId");
  const unassigned = searchParams.get("unassigned") === "1";
  const [words, setWords] = useState([]);
  const [practiceName, setPracticeName] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      const [items, practice] = await Promise.all([
        listVocabulary(null, practiceId, unassigned),
        practiceId ? getPractice(practiceId) : Promise.resolve(null),
      ]);
      setWords(items);
      setPracticeName(practice?.name || (unassigned ? "未归类收藏" : ""));
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { load(); }, [practiceId, unassigned]);

  async function remove(id) {
    await deleteFavorite(id);
    setWords((current) => current.filter((item) => item.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  return (
    <main className="home-page vocabulary-page">
      <AppHeader />
      <section className="page-title-block vocabulary-title-block">
        <p className="flow-eyebrow">VOCABULARY</p>
        <h1>{practiceName || "单词本"}</h1>
        <p>{practiceId ? "仅显示这个练习中收藏的单词。" : unassigned ? "未关联到具体练习的收藏单词。" : "保留单词在真实听力语境中的含义。"}</p>
        {(practiceId || unassigned) && <Link className="text-action" to="/vocabulary">查看全部收藏</Link>}
      </section>
      {error && <p className="flow-error">{error}</p>}
      {words.length === 0 ? <div className="home-empty"><PiStarFill /><h3>{practiceId ? "这个练习还没有收藏单词" : "还没有收藏单词"}</h3><p>在听写结果或 Transcript 中点击英文单词即可查询并收藏。</p></div> : (
        <section className="vocabulary-list">{words.map((word) => (
          <article className="vocabulary-item" key={word.id}>
            <button className="vocabulary-main" type="button" onClick={() => setSelected(word)}>
              <div><h2>{word.word}</h2><p>{word.phonetic_uk} · {word.part_of_speech}</p></div><strong>{word.meaning_zh}</strong>
            </button>
            <details><summary>查看语境与来源</summary><blockquote>{word.source_sentence}</blockquote><p>{word.meaning_in_context}</p><small>来源：{word.practice_id ? <Link to={`/practice/${word.practice_id}`}>{word.practice_name || "未命名练习"}</Link> : "未命名练习"} · {formatLocalTime(word.created_at)}</small></details>
            <button className="vocabulary-delete" type="button" onClick={() => remove(word.id)} aria-label={`删除 ${word.word}`}><PiTrash /></button>
          </article>
        ))}</section>
      )}
      {selected && <WordCard word={selected.word} sentence={selected.source_sentence} practiceId={selected.practice_id} initialExplanation={selected} onClose={() => setSelected(null)} onFavoriteChange={load} />}
    </main>
  );
}
