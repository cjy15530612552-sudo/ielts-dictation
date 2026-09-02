import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PiArrowCounterClockwise, PiHouse } from "react-icons/pi";
import { appAssetUrl, completePractice, endPracticeSession, getPractice, saveProgress } from "../api/appApi.js";
import { alignTokens } from "../utils/alignTokens.js";
import { AUTO_PLAY_NEXT, INITIAL_SENTENCE_INDEX, MOCK_PLAYBACK_MS, mockSentences } from "../data/mockSentences.js";
import { formatKeyCode, loadKeyboardBindings } from "../utils/keyboardBindings.js";
import { insertAnswerGap } from "../utils/insertAnswerGap.js";
import { findVerticalInputIndex } from "../utils/verticalInputNavigation.js";
import { DictationControls } from "./DictationControls.jsx";
import { ImportButton } from "./ImportButton.jsx";
import { ProgressIndicator } from "./ProgressIndicator.jsx";
import { SentencePlayer } from "./SentencePlayer.jsx";
import { SentenceResult } from "./SentenceResult.jsx";
import { ShortcutHint } from "./ShortcutHint.jsx";
import { WordCard } from "./WordCard.jsx";
import { WordInputRow } from "./WordInputRow.jsx";

const SLOT_WIDTHS = [118, 154, 102, 160, 148, 148, 150, 134, 112, 158, 132, 120];
const tokenize = (text) => text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|£\d+(?:\.\d+)?|\d{1,2}:\d{2}|[\p{L}\p{N}]+(?:['’][\p{L}]+)*(?:-[\p{L}\p{N}]+)*/gu) ?? [];
const normalizeSentences = (items) => items.map((item) => ({
  id: item.id,
  text: item.display_text,
  tokens: tokenize(item.display_text),
  audioUrl: item.audio_url,
}));

export function DictationPage() {
  const { practiceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPractice = Boolean(practiceId);
  const [practice, setPractice] = useState(null);
  const [sentences, setSentences] = useState(isPractice ? [] : mockSentences);
  const [sentenceIndex, setSentenceIndex] = useState(isPractice ? 0 : INITIAL_SENTENCE_INDEX);
  const [loading, setLoading] = useState(isPractice);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [lookup, setLookup] = useState(null);
  const [scores, setScores] = useState([]);
  const [completion, setCompletion] = useState(null);
  const [keyboardBindings] = useState(loadKeyboardBindings);
  const inputRefs = useRef([]);
  const playbackTimerRef = useRef(null);
  const audioRef = useRef(null);
  const autoPlayNextRef = useRef(false);
  const sentence = sentences[sentenceIndex];

  useEffect(() => {
    if (!isPractice) { setAnswers(mockSentences[INITIAL_SENTENCE_INDEX].tokens.map(() => "")); return; }
    getPractice(practiceId).then((loaded) => {
      setPractice(loaded);
      if (loaded.audio_ready === false) throw new Error("该练习的语音尚未全部生成，请返回首页点击“设置”后重试生成。");
      const loadedSentences = normalizeSentences(loaded.sentences ?? []);
      if (!loadedSentences.length) throw new Error("该练习还没有可训练的句子");
      const start = searchParams.get("restart") === "1" ? 0 : Math.min(Math.max(loaded.current_sentence - 1, 0), loadedSentences.length - 1);
      setSentences(loadedSentences); setSentenceIndex(start); setAnswers(loadedSentences[start].tokens.map(() => ""));
    }).catch((error) => setLoadError(error.message)).finally(() => setLoading(false));
  }, [isPractice, practiceId, searchParams]);

  const slotWidths = useMemo(() => sentence?.tokens.map((_, index) => SLOT_WIDTHS[index % SLOT_WIDTHS.length]) ?? [], [sentence]);
  const focusWord = useCallback((index, caretPosition) => {
    if (!sentence) return;
    if (index < 0 || index >= sentence.tokens.length) return;
    setCurrentWordIndex(index);
    window.requestAnimationFrame(() => {
      const input = inputRefs.current[index];
      input?.focus();
      if (input && caretPosition) {
        const caret = caretPosition === "start" ? 0 : input.value.length;
        input.setSelectionRange(caret, caret);
      }
    });
  }, [sentence]);
  const stopPlayback = useCallback(() => {
    if (playbackTimerRef.current) window.clearTimeout(playbackTimerRef.current);
    playbackTimerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);
  const replayCurrentSentence = useCallback(async () => {
    if (!sentence) return;
    const focusedIndex = currentWordIndex;
    stopPlayback();
    setPlaybackError("");
    setHasPlayed(true);
    if (!isPractice) {
      setIsPlaying(true);
      playbackTimerRef.current = window.setTimeout(() => { setIsPlaying(false); playbackTimerRef.current = null; }, MOCK_PLAYBACK_MS);
    } else {
      const audioUrl = sentence.audioUrl;
      try {
        if (!audioUrl) throw new Error("该句音频尚未生成，请返回设置页面重试生成全部语音。");
        const audio = new Audio(appAssetUrl(audioUrl));
        audioRef.current = audio;
        audio.addEventListener("play", () => setIsPlaying(true), { once: true });
        audio.addEventListener("ended", () => { setIsPlaying(false); audioRef.current = null; }, { once: true });
        audio.addEventListener("error", () => { setIsPlaying(false); setPlaybackError("这句话的语音文件无法播放，请返回设置页重新保存原文。"); }, { once: true });
        await audio.play();
      } catch (error) {
        setIsPlaying(false);
        setPlaybackError(error.message || "语音生成或播放失败，请检查 AI 配置。");
      }
    }
    if (!isSubmitted) window.requestAnimationFrame(() => inputRefs.current[focusedIndex]?.focus());
  }, [currentWordIndex, isPractice, isSubmitted, sentence, stopPlayback]);
  useEffect(() => () => stopPlayback(), [stopPlayback]);
  useEffect(() => { if (sentence && !isSubmitted) focusWord(0); }, [sentence?.id, focusWord, isSubmitted]);
  useEffect(() => {
    if (!sentence || !autoPlayNextRef.current) return;
    autoPlayNextRef.current = false;
    const timer = window.setTimeout(() => replayCurrentSentence(), 80);
    return () => window.clearTimeout(timer);
  }, [sentence?.id, replayCurrentSentence]);

  function updateAnswer(index, value) { setAnswers((current) => current.map((answer, i) => i === index ? value : answer)); }
  function insertGap(index) {
    const shifted = insertAnswerGap(answers, index);
    if (shifted === answers) return;
    setAnswers(shifted);
    focusWord(index, "start");
  }
  function moveVertical(index, direction) {
    const rects = inputRefs.current.map((input) => input?.getBoundingClientRect() ?? null);
    const targetIndex = findVerticalInputIndex(rects, index, direction);
    if (targetIndex !== index) focusWord(targetIndex, "end");
  }
  function submitSentence() {
    if (isSubmitted || !sentence) return;
    stopPlayback();
    const aligned = alignTokens(sentence.tokens, answers);
    setResult(aligned); setIsSubmitted(true);
    setScores((current) => {
      const updated = [...current];
      updated[sentenceIndex] = Math.round((aligned.correctCount / aligned.aligned.length) * 100);
      return updated;
    });
  }
  function restartCurrentSentence() {
    if (!sentence) return;
    stopPlayback();
    setAnswers(sentence.tokens.map(() => ""));
    setScores((current) => {
      const updated = [...current];
      updated[sentenceIndex] = undefined;
      return updated;
    });
    setCurrentWordIndex(0); setHasPlayed(false); setIsSubmitted(false); setResult(null); setPlaybackError("");
    replayCurrentSentence();
    focusWord(0);
  }
  function loadSentence(nextIndex, shouldPlay) {
    stopPlayback(); const next = sentences[nextIndex]; setSentenceIndex(nextIndex); setAnswers(next.tokens.map(() => ""));
    setCurrentWordIndex(0); setHasPlayed(false); setIsSubmitted(false); setResult(null); setPlaybackError("");
    autoPlayNextRef.current = shouldPlay;
  }
  async function goToNextSentence() {
    if (sentenceIndex >= sentences.length - 1 && isPractice) {
      const completed = await completePractice(practiceId);
      const completedScores = scores.filter(Number.isFinite);
      const average = completedScores.length ? Math.round(completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length) : 0;
      setCompletion({ total: sentences.length, accuracy: average, favorites: completed.favorite_count ?? 0 });
      return;
    }
    const nextIndex = (sentenceIndex + 1) % sentences.length;
    if (isPractice) await saveProgress(practiceId, nextIndex + 1);
    loadSentence(nextIndex, AUTO_PLAY_NEXT);
  }
  async function goToPreviousSentence() {
    if (sentenceIndex <= 0) return;
    const previousIndex = sentenceIndex - 1;
    if (isPractice) await saveProgress(practiceId, previousIndex + 1);
    loadSentence(previousIndex, false);
  }
  async function endSession() {
    await saveProgress(practiceId, sentenceIndex + 1);
    await endPracticeSession(practiceId);
    navigate("/");
  }
  function restart() { setScores([]); setCompletion(null); loadSentence(0, false); }
  function handlePracticeKeyDown(event) {
    if (event.code === keyboardBindings.replay) { event.preventDefault(); replayCurrentSentence(); }
    else if (event.code === keyboardBindings.stop) { event.preventDefault(); stopPlayback(); }
  }

  if (loading) return <main className="dictation-page"><p className="flow-loading">正在读取上次练习进度…</p></main>;
  if (loadError) return <main className="dictation-page"><div className="dictation-blocked"><p className="flow-error">{loadError}</p>{practice?.transcript_session_id && <Link className="primary-link" to={`/transcript/${practice.transcript_session_id}/review`}>返回设置并生成全部语音</Link>}<Link className="text-action" to="/">返回首页</Link></div></main>;
  if (completion) return <main className="completion-page"><div><p className="flow-eyebrow">SESSION COMPLETE</p><h1>本次完成</h1><strong>{completion.total} / {completion.total}</strong><p>Accuracy {completion.accuracy}%</p><p>收藏单词 {completion.favorites}</p><Link className="primary-link" to="/"><PiHouse />返回首页</Link><button className="secondary-button" type="button" onClick={restart}><PiArrowCounterClockwise />重新练习</button></div></main>;

  return (
    <main className="dictation-page">
      <header className="page-header"><div><h1 className="brand-title">{practice?.name || "IELTS Dictation"}</h1><p className="brand-subtitle">逐句精听</p></div><div className="header-actions">{isPractice ? <button className="import-button" type="button" onClick={endSession}>结束本次练习</button> : <ImportButton />}<ProgressIndicator current={sentenceIndex + 1} total={sentences.length} /></div></header>
      <section className="practice-shell" onKeyDown={handlePracticeKeyDown}>
        <p className="practice-prompt">听写你听到的句子</p><SentencePlayer isPlaying={isPlaying} hasPlayed={hasPlayed} onPlay={replayCurrentSentence} />
        {playbackError && <p className="flow-error playback-error" role="alert">{playbackError}</p>}
        {!isSubmitted ? <><WordInputRow tokens={sentence.tokens} answers={answers} currentWordIndex={currentWordIndex} inputRefs={inputRefs} slotWidths={slotWidths} disabled={isSubmitted} onAnswerChange={updateAnswer} onFocusWord={setCurrentWordIndex} onMove={(offset, caretPosition) => focusWord(currentWordIndex + offset, caretPosition)} onInsertGap={insertGap} onMoveVertical={moveVertical} onSubmit={submitSentence} onReplay={replayCurrentSentence} onStop={stopPlayback} bindings={keyboardBindings} /><DictationControls onReplay={replayCurrentSentence} onSubmit={submitSentence} replayShortcut={formatKeyCode(keyboardBindings.replay)} /></> : <SentenceResult result={result} slotWidths={slotWidths} onPrevious={goToPreviousSentence} onReplay={replayCurrentSentence} onRestart={restartCurrentSentence} onNext={goToNextSentence} onWordClick={(word) => setLookup({ word, sentence: sentence.text })} isFirst={sentenceIndex === 0} isLast={isPractice && sentenceIndex === sentences.length - 1} />}
      </section>
      <footer className="keyboard-footer" aria-label="快捷键说明"><ShortcutHint shortcut={formatKeyCode(keyboardBindings.advance)} label="插入空格" /><span className="footer-separator">|</span><ShortcutHint shortcut="← →" label="移动光标 / 跨格" /><span className="footer-separator">|</span><ShortcutHint shortcut="↑ ↓" label="上下格" /><span className="footer-separator">|</span><ShortcutHint shortcut={formatKeyCode(keyboardBindings.submit)} label="下一格 / 检查" /><span className="footer-separator">|</span><ShortcutHint shortcut={formatKeyCode(keyboardBindings.stop)} label="停止" /></footer>
      {lookup && <WordCard word={lookup.word} sentence={lookup.sentence} practiceId={practiceId} onClose={() => setLookup(null)} />}
    </main>
  );
}
