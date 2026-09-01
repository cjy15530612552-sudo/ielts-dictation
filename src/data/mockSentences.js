function createSentence(id, text) {
  return {
    id,
    text,
    audioUrl: `/mock/audio${id}.mp3`,
    tokens: text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|£\d+(?:\.\d+)?|\d{1,2}:\d{2}|[\p{L}\p{N}]+(?:['’][\p{L}]+)*(?:-[\p{L}\p{N}]+)*/gu) ?? [],
  };
}

export const mockSentences = [
  createSentence(1, "You need to complete the application form."),
  createSentence(2, "The museum closes at half past five."),
  createSentence(3, "The library is located on the second floor."),
  createSentence(4, "Please bring some form of identification."),
  createSentence(5, "The accommodation costs £150 per week."),
  createSentence(6, "Our next meeting is at 10:30 on Friday."),
  createSentence(7, "You can contact Johnson on 07700 900123."),
  createSentence(8, "The postcode is SW1A 1AA."),
  createSentence(9, "Send the details to john@example.com."),
  createSentence(10, "She works part-time at the visitor centre."),
  createSentence(11, "Manchester is approximately forty miles away."),
  createSentence(12, "We've reserved a table near the window."),
  createSentence(13, "I'd like to book a room for next Friday."),
  createSentence(14, "The guided tour lasts about ninety minutes."),
  createSentence(15, "Students should leave their bags at reception."),
  createSentence(16, "Breakfast is served from seven until nine."),
  createSentence(17, "The final payment is due on 25 September."),
  createSentence(18, "Please wait outside the main lecture theatre."),
];

export const INITIAL_SENTENCE_INDEX = 2;
export const MOCK_PLAYBACK_MS = 3000;
export const AUTO_PLAY_NEXT = true;
