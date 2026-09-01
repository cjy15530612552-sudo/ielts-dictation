export function normalizeToken(token) {
  return token.trim().toLocaleLowerCase("en-GB").replace(/[’]/g, "'");
}

function characterDistance(left, right) {
  const a = normalizeToken(left);
  const b = normalizeToken(right);
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

function substitutionCost(expected, entered) {
  if (normalizeToken(expected) === normalizeToken(entered)) return 0;
  const longest = Math.max(expected.length, entered.length, 1);
  return 0.5 + (characterDistance(expected, entered) / longest) * 0.5;
}

export function alignTokens(expectedTokens, enteredTokens) {
  const entered = enteredTokens.map((token) => token.trim()).filter(Boolean);
  const rows = expectedTokens.length + 1;
  const cols = entered.length + 1;
  const cost = Array.from({ length: rows }, () => Array(cols).fill(0));
  const move = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let i = 1; i < rows; i += 1) {
    cost[i][0] = i;
    move[i][0] = "missing";
  }
  for (let j = 1; j < cols; j += 1) {
    cost[0][j] = j;
    move[0][j] = "extra";
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const replacementCost = substitutionCost(expectedTokens[i - 1], entered[j - 1]);
      const same = replacementCost === 0;
      const candidates = [
        { value: cost[i - 1][j - 1] + replacementCost, type: same ? "correct" : "wrong" },
        { value: cost[i - 1][j] + 1, type: "missing" },
        { value: cost[i][j - 1] + 1, type: "extra" },
      ];
      const best = candidates.reduce((winner, candidate) =>
        candidate.value < winner.value ? candidate : winner,
      );
      cost[i][j] = best.value;
      move[i][j] = best.type;
    }
  }

  const aligned = [];
  const extras = [];
  let i = expectedTokens.length;
  let j = entered.length;

  while (i > 0 || j > 0) {
    const type = move[i][j];
    if (type === "correct" || type === "wrong") {
      aligned.push({ type, expected: expectedTokens[i - 1], entered: entered[j - 1] });
      i -= 1;
      j -= 1;
    } else if (type === "missing") {
      aligned.push({ type: "missing", expected: expectedTokens[i - 1], entered: "" });
      i -= 1;
    } else {
      extras.unshift(entered[j - 1]);
      j -= 1;
    }
  }

  return {
    aligned: aligned.reverse(),
    extras,
    correctCount: aligned.filter((item) => item.type === "correct").length,
    issueCount: aligned.filter((item) => item.type !== "correct").length + extras.length,
  };
}
