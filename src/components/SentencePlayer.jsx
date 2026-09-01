import { PiPlayFill, PiSpeakerHigh } from "react-icons/pi";

export function SentencePlayer({ isPlaying, hasPlayed, onPlay }) {
  const label = isPlaying ? "正在播放..." : hasPlayed ? "再听一遍" : "播放句子";
  const Icon = isPlaying ? PiSpeakerHigh : PiPlayFill;

  return (
    <div className="sentence-player">
      <button className="play-button" type="button" onClick={onPlay} aria-label={label}>
        <span className="play-button-icon" aria-hidden="true"><Icon /></span>
        <span>{label}</span>
      </button>
    </div>
  );
}
