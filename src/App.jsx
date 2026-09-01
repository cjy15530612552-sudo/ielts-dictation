import { Navigate, Route, Routes } from "react-router-dom";
import { DictationPage } from "./components/DictationPage.jsx";
import { TranscriptReviewPage } from "./pages/TranscriptReviewPage.jsx";
import { TranscriptUploadPage } from "./pages/TranscriptUploadPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { VocabularyPage } from "./pages/VocabularyPage.jsx";
import { PracticeDetailPage } from "./pages/PracticeDetailPage.jsx";
import { TtsPlaygroundPage } from "./pages/TtsPlaygroundPage.jsx";
import { AiSettingsPage } from "./pages/AiSettingsPage.jsx";
import { KeyboardSettingsPage } from "./pages/KeyboardSettingsPage.jsx";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/practice/new" element={<TranscriptUploadPage />} />
      <Route path="/import" element={<Navigate to="/practice/new" replace />} />
      <Route path="/practice/:practiceId" element={<PracticeDetailPage />} />
      <Route path="/practice/:practiceId/dictation" element={<DictationPage />} />
      <Route path="/dictation" element={<DictationPage />} />
      <Route path="/vocabulary" element={<VocabularyPage />} />
      <Route path="/tts-playground" element={<TtsPlaygroundPage />} />
      <Route path="/ai-settings" element={<AiSettingsPage />} />
      <Route path="/keyboard-settings" element={<KeyboardSettingsPage />} />
      <Route path="/transcript/:sessionId/review" element={<TranscriptReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
