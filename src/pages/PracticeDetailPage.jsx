import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PiArrowCounterClockwise, PiFileText } from "react-icons/pi";
import { getPractice } from "../api/appApi.js";
import { AppHeader } from "../components/AppHeader.jsx";
import { formatLocalTime } from "../utils/formatLocalTime.js";

export function PracticeDetailPage() {
  const { practiceId } = useParams();
  const [practice, setPractice] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getPractice(practiceId).then(setPractice).catch((err) => setError(err.message)); }, [practiceId]);
  if (error) return <main className="home-page"><AppHeader /><p className="flow-error">{error}</p></main>;
  if (!practice) return <main className="home-page"><AppHeader /><p className="flow-loading">正在读取练习…</p></main>;
  return (
    <main className="home-page"><AppHeader /><section className="practice-detail">
      <p className="flow-eyebrow">PRACTICE DETAIL</p><h1>{practice.name}</h1>
      <div className="detail-stats"><div><span>句子</span><strong>{practice.total_sentences}</strong></div><div><span>状态</span><strong>{practice.completed ? "已完成" : `${practice.current_sentence} / ${practice.total_sentences}`}</strong></div><div><span>上次完成</span><strong>{formatLocalTime(practice.last_completed_at)}</strong></div><div><span>收藏单词</span><strong>{practice.favorite_count}</strong></div></div>
      <div className="detail-actions"><Link className="primary-link" to={`/practice/${practice.id}/dictation?restart=1`}><PiArrowCounterClockwise />重新练习</Link><Link className="secondary-button" to="/vocabulary">查看收藏单词</Link><details><summary><PiFileText />查看 Transcript</summary><pre>{practice.transcript?.full_text}</pre></details></div>
    </section></main>
  );
}
