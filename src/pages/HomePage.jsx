import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PiArrowCounterClockwise, PiArrowRight, PiBookOpen, PiGear, PiPlus } from "react-icons/pi";
import { listPractices, listVocabularyGroups, restartPractice } from "../api/appApi.js";
import { AppHeader } from "../components/AppHeader.jsx";
import { formatLocalTime } from "../utils/formatLocalTime.js";

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [practices, setPractices] = useState([]);
  const [vocabularyGroups, setVocabularyGroups] = useState([]);
  const [error, setError] = useState("");
  const [restartingId, setRestartingId] = useState(null);

  useEffect(() => {
    Promise.all([listPractices(), listVocabularyGroups()])
      .then(([practiceItems, groupItems]) => { setPractices(practiceItems); setVocabularyGroups(groupItems); })
      .catch((requestError) => setError(requestError.message));
  }, []);

  async function restart(practice) {
    if (restartingId) return;
    setRestartingId(practice.id);
    setError("");
    try {
      await restartPractice(practice.id);
      navigate(`/practice/${practice.id}/dictation?restart=1`);
    } catch (requestError) {
      setError(requestError.message || "无法重新开始练习");
      setRestartingId(null);
    }
  }

  return (
    <main className="home-page">
      <AppHeader />
      <section className="home-hero">
        <p className="flow-eyebrow">LISTEN · WRITE · REVIEW</p>
        <h1>把每一次精听，<br />变成看得见的进步。</h1>
        <p>从 IELTS 原文截图开始，逐句听写、校对并积累真正属于你的语境词汇。</p>
      </section>
      {location.state?.created && <p className="home-notice" role="status">新练习已保存并加入首页。</p>}
      {error && <p className="flow-error">{error}</p>}

      <section className="home-section">
        <div className="home-section-heading"><div><h2>我的听力练习</h2><p>{practices.length} 个练习</p></div><Link to="/practice/new"><PiPlus />新建练习</Link></div>
        {practices.length === 0 ? (
          <div className="home-empty"><PiBookOpen /><h3>还没有听力练习</h3><p>上传 IELTS 原文截图，创建你的第一次精听练习。</p><Link className="primary-link" to="/practice/new"><PiPlus />新建练习</Link></div>
        ) : (
          <div className="practice-grid">
            {practices.map((practice) => {
              const audioBlocked = practice.audio_ready === false;
              const practiceUrl = audioBlocked
                ? (practice.transcript_session_id ? `/transcript/${practice.transcript_session_id}/review` : "/practice/new")
                : (practice.completed ? `/practice/${practice.id}` : `/practice/${practice.id}/dictation`);
              return <article className={`practice-card${audioBlocked ? " is-audio-pending" : ""}`} key={practice.id}>
                <div className="practice-card-top">
                  <span>{audioBlocked ? "等待生成语音" : practice.completed ? "已完成" : "进行中"}</span>
                  <div className="practice-card-actions">
                    <button className="practice-restart-link" type="button" onClick={() => restart(practice)} disabled={audioBlocked || restartingId === practice.id} aria-label={`重新开始 ${practice.name}`}><PiArrowCounterClockwise />{restartingId === practice.id ? "重置中" : "重新开始"}</button>
                    <Link className="practice-settings-link" to={practice.transcript_session_id ? `/transcript/${practice.transcript_session_id}/review` : "/practice/new"} aria-label={`设置 ${practice.name}`}><PiGear />设置</Link>
                    <Link className="practice-open-link" to={practiceUrl} aria-label={audioBlocked ? `生成 ${practice.name} 的全部语音` : `打开 ${practice.name}`}><PiArrowRight /></Link>
                  </div>
                </div>
                <Link className="practice-card-body" to={practiceUrl}>
                  <h3>{practice.name}</h3>
                  <p>{(practice.part ?? "part1").replace("part", "Part ")} · {practice.total_sentences} 句</p>
                  <div className="practice-card-footer"><div><span>{audioBlocked ? "音频生成" : "上次完成"}</span><strong>{audioBlocked ? "完成后才可练习" : formatLocalTime(practice.last_completed_at)}</strong></div><b>{audioBlocked ? `${practice.audio_ready_count || 0} / ${practice.total_sentences || "—"} 音频` : practice.completed ? "已完成" : `${practice.current_sentence} / ${practice.total_sentences || "—"} 句`}</b></div>
                </Link>
              </article>;
            })}
          </div>
        )}
      </section>

      <section className="home-section vocabulary-preview">
        <div className="home-section-heading"><div><h2>收藏单词</h2><p>最近收藏</p></div><Link to="/vocabulary">查看全部 <PiArrowRight /></Link></div>
        {vocabularyGroups.length === 0 ? (
          <div className="home-empty compact"><h3>还没有收藏单词</h3><p>训练过程中点击单词并按 ☆，即可加入单词本。</p></div>
        ) : (
          <div className="word-preview-grid">{vocabularyGroups.map((group) => (
            <Link className="vocabulary-group-card" key={group.practice_id || "unassigned"} to={group.practice_id ? `/vocabulary?practiceId=${encodeURIComponent(group.practice_id)}` : "/vocabulary?unassigned=1"}>
              <span>来源练习</span>
              <h3>{group.practice_name || "未归类收藏"}</h3>
              <p>{group.word_count} 个收藏单词</p>
              <strong>查看词表 <PiArrowRight /></strong>
            </Link>
          ))}</div>
        )}
      </section>
    </main>
  );
}
