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

export function removeAnswerGap(answers, index) {
  if (answers[index]) return answers;

  let lastContentIndex = -1;
  for (let answerIndex = answers.length - 1; answerIndex > index; answerIndex -= 1) {
    if (answers[answerIndex]) {
      lastContentIndex = answerIndex;
      break;
    }
  }
  if (lastContentIndex === -1) return answers;

  const shifted = [...answers];
  for (let answerIndex = index; answerIndex < lastContentIndex; answerIndex += 1) {
    shifted[answerIndex] = shifted[answerIndex + 1];
  }
  shifted[lastContentIndex] = "";
  return shifted;
}
