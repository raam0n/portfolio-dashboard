const squarify = (items, x, y, w, h) => {
  if (!items.length || w <= 0 || h <= 0) return [];
  const total = items.reduce((s, it) => s + it.size, 0);
  if (total <= 0) return [];

  const rects = [];
  let remaining = [...items];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const remTotal = remaining.reduce((s, it) => s + it.size, 0);
    const isVertical = cw >= ch;
    const side = isVertical ? ch : cw;

    // Greedy: keep adding items to the current row while the aspect ratio improves
    let row = [remaining[0]];
    let bestWorst = worstAspect(row, side, remTotal, cw * ch);

    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candidateWorst = worstAspect(candidate, side, remTotal, cw * ch);
      if (candidateWorst <= bestWorst) {
        row = candidate;
        bestWorst = candidateWorst;
      } else {
        break;
      }
    }

    // Layout the row
    const rowSum = row.reduce((s, it) => s + it.size, 0);
    const rowFrac = rowSum / remTotal;

    let rx = cx, ry = cy;
    if (isVertical) {
      const rowWidth = cw * rowFrac;
      let runY = cy;
      for (const item of row) {
        const itemFrac = item.size / rowSum;
        const itemH = ch * itemFrac;
        rects.push({ ...item, x: rx, y: runY, w: rowWidth, h: itemH });
        runY += itemH;
      }
      cx += rowWidth;
      cw -= rowWidth;
    } else {
      const rowHeight = ch * rowFrac;
      let runX = cx;
      for (const item of row) {
        const itemFrac = item.size / rowSum;
        const itemW = cw * itemFrac;
        rects.push({ ...item, x: runX, y: ry, w: itemW, h: rowHeight });
        runX += itemW;
      }
      cy += rowHeight;
      ch -= rowHeight;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
};

function worstAspect(row, side, total, area) {
  let worst = 0;
  const rowSum = row.reduce((s, it) => s + it.size, 0);
  const rowFrac = rowSum / total;
  const rowSide = area * rowFrac / side;

  for (const item of row) {
    const itemFrac = item.size / rowSum;
    const other = side * itemFrac;
    if (other === 0 || rowSide === 0) continue;
    const ar = Math.max(other / rowSide, rowSide / other);
    worst = Math.max(worst, ar);
  }
  return worst;
}

// Run test with 15 items of varying sizes
const items = Array.from({ length: 15 }, (_, i) => ({
  name: `Item ${i + 1}`,
  size: Math.pow(1.5, 15 - i)
}));

const result = squarify(items, 0, 0, 500, 500);
console.log("Input length:", items.length);
console.log("Result length:", result.length);
console.log("Result items:", result.map(r => r.name));
