/** Line-level diff (LCS) for the GitHub-style résumé diff viewer. */
export type DiffOp = { type: "equal" | "added" | "removed"; text: string };

export function lineDiff(a: string, b: string): DiffOp[] {
  const A = a.replace(/\r/g, "").split("\n");
  const B = b.replace(/\r/g, "").split("\n");
  const n = A.length, m = B.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ type: "equal", text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: "removed", text: A[i] }); i++; }
    else { ops.push({ type: "added", text: B[j] }); j++; }
  }
  while (i < n) { ops.push({ type: "removed", text: A[i] }); i++; }
  while (j < m) { ops.push({ type: "added", text: B[j] }); j++; }
  return ops;
}
