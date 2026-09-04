import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PiHeadphones, PiPause, PiSpeakerHigh, PiStarFill, PiTrash } from "react-icons/pi";
import { appAssetUrl, deleteFavorite, generateFavoriteAudio, getPractice, listVocabulary } from "../api/appApi.js";
import { AppHeader } from "../components/AppHeader.jsx";
import { VocabularyDictation } from "../components/VocabularyDictation.jsx";
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
  const [playingId, setPlayingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [isDictating, setIsDictating] = useState(false);
  const audioRef = useRef(null);
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
  useEffect(() => {
    audioRef.current?.pause();
    setPlayingId(null);
    setIsDictating(false);
  }, [practiceId, unassigned]);
  useEffect(() => () => audioRef.current?.pause(), []);

  async function remove(id) {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    await deleteFavorite(id);
    setWords((current) => current.filter((item) => item.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function stopPronunciation() {
    audioRef.current?.pause();
    setPlayingId(null);
  }

  async function playPronunciation(word, toggle = true) {
    setError("");
    if (toggle && playingId === word.id && audioRef.current) {
      stopPronunciation();
      return;
    }
    audioRef.current?.pause();
    let playable = word;
    try {
      if (!playable.audio_url || playable.audio_status !== "ready") {
        setGeneratingId(word.id);
        playable = await generateFavoriteAudio(word.id);
        setWords((current) => current.map((item) => item.id === word.id ? playable : item));
        if (!playable.audio_url || playable.audio_status !== "ready") {
          throw new Error(playable.audio_error || "单词发音生成失败，请检查 AI 配置后重试。");
        }
      }
      const audio = new Audio(appAssetUrl(playable.audio_url));
      audioRef.current = audio;
      audio.addEventListener("ended", () => setPlayingId(null), { once: true });
      audio.addEventListener("error", () => {
        setPlayingId(null);
        setError(`${word.word} 的发音文件无法播放，请点击喇叭重新生成。`);
      }, { once: true });
      await audio.play();
      setPlayingId(word.id);
    } catch (requestError) {
      setPlayingId(null);
      setError(requestError.message);
    } finally {
      setGeneratingId(null);
    }
  }

  function startDictation() {
    if (words.length === 0) return;
    setIsDictating(true);
    playPronunciation(words[0], false);
  }

  function exitDictation() {
    stopPronunciation();
    setError("");
    setIsDictating(false);
  }

  if (isDictating && words.length > 0) {
    return (
      <main className="home-page vocabulary-page vocabulary-dictation-page">
        <AppHeader />
        <VocabularyDictation
          words={words}
          title={practiceName || "收藏单词"}
          onExit={exitDictation}
          onPlay={(word) => playPronunciation(word, false)}
          onStop={stopPronunciation}
          audioBusy={generatingId !== null}
          audioError={error}
        />
      </main>
    );
  }

  return (
    <main className="home-page vocabulary-page">
      <AppHeader />
      <section className="page-title-block vocabulary-title-block">
        <div className="vocabulary-title-row">
          <div className="vocabulary-title-copy">
            <p className="flow-eyebrow">VOCABULARY</p>
            <h1>{practiceName || "单词本"}</h1>
            <p>{practiceId ? "仅显示这个练习中收藏的单词。" : unassigned ? "未关联到具体练习的收藏单词。" : "保留单词在真实听力语境中的含义。"}</p>
          </div>
          {words.length > 0 && (
            <button className="vocabulary-dictation-start" type="button" onClick={startDictation}>
              <PiHeadphones />进行听写
            </button>
          )}
        </div>
        {(practiceId || unassigned) && <Link className="text-action" to="/vocabulary">查看全部收藏</Link>}
      </section>
      {error && <p className="flow-error">{error}</p>}
      {words.length === 0 ? <div className="home-empty"><PiStarFill /><h3>{practiceId ? "这个练习还没有收藏单词" : "还没有收藏单词"}</h3><p>在听写结果或 Transcript 中点击英文单词即可查询并收藏。</p></div> : (
        <section className="vocabulary-list">{words.map((word) => (
          <article className="vocabulary-item" key={word.id}>
            <div className="vocabulary-main">
              <div className="vocabulary-word-block">
                <button className="vocabulary-open" type="button" onClick={() => setSelected(word)}><h2>{word.word}</h2></button>
                <div className="vocabulary-meta"><span>{word.phonetic_uk} · {word.part_of_speech}</span><button className={`vocabulary-audio${word.audio_status === "failed" ? " is-error" : ""}`} type="button" onClick={() => playPronunciation(word)} disabled={generatingId === word.id} aria-label={word.audio_url ? `${playingId === word.id ? "暂停" : "播放"} ${word.word} 发音` : `生成 ${word.word} 发音`} title={word.audio_status === "failed" ? "上次生成失败，点击重试" : "播放单词发音"}>{playingId === word.id ? <PiPause /> : <PiSpeakerHigh />}<span>{generatingId === word.id ? "生成中…" : ""}</span></button></div>
              </div>
              <button className="vocabulary-meaning" type="button" onClick={() => setSelected(word)}><strong>{word.meaning_zh}</strong></button>
            </div>
            <details><summary>查看语境与来源</summary><blockquote>{word.source_sentence}</blockquote><p>{word.meaning_in_context}</p><small>来源：{word.practice_id ? <Link to={`/practice/${word.practice_id}`}>{word.practice_name || "未命名练习"}</Link> : "未命名练习"} · {formatLocalTime(word.created_at)}</small></details>
            <button className="vocabulary-delete" type="button" onClick={() => remove(word.id)} aria-label={`删除 ${word.word}`}><PiTrash /></button>
          </article>
        ))}</section>
      )}
      {selected && <WordCard word={selected.word} sentence={selected.source_sentence} practiceId={selected.practice_id} initialExplanation={selected} onClose={() => setSelected(null)} onFavoriteChange={load} />}
    </main>
  );
}
