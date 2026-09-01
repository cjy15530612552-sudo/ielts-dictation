export function insertAnswerGap(answers, index) {
  if (!answers[index]) return answers;

  const emptyIndex = answers.findIndex((answer, answerIndex) => answerIndex > index && !answer);
  if (emptyIndex === -1) return answers;

  const shifted = [...answers];
  for (let answerIndex = emptyIndex; answerIndex > index; answerIndex -= 1) {
    shifted[answerIndex] = shifted[answerIndex - 1];
  }
  shifted[index] = "";
  return shifted;
}
