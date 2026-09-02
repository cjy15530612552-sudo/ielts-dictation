export function findVerticalInputIndex(rects, currentIndex, direction) {
  if (direction !== -1 && direction !== 1) return currentIndex;
  const current = rects[currentIndex];
  if (!current) return currentIndex;

  const currentCenterX = (current.left + current.right) / 2;
  const candidates = rects.flatMap((rect, index) => {
    if (!rect || index === currentIndex) return [];
    const verticalGap = direction < 0 ? current.top - rect.bottom : rect.top - current.bottom;
    if (verticalGap < -1) return [];
    const centerX = (rect.left + rect.right) / 2;
    return [{ index, verticalGap: Math.max(0, verticalGap), horizontalGap: Math.abs(centerX - currentCenterX) }];
  });

  candidates.sort((left, right) => left.verticalGap - right.verticalGap || left.horizontalGap - right.horizontalGap || left.index - right.index);
  return candidates[0]?.index ?? currentIndex;
}
