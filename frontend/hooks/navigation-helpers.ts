export type NavigateAction = "prev" | "next"

export function computeTargetIndex(
  current: number,
  total: number,
  loop: boolean,
  action: NavigateAction
): number {
  if (total <= 0) return current
  const last = total - 1
  if (action === "prev") {
    if (current > 0) return current - 1
    return loop && last >= 0 ? last : current
  }
  // next
  if (current < last) return current + 1
  return loop && last >= 0 ? 0 : current
}

export function computeNextOnFinish(current: number, total: number, loop: boolean): number | null {
  if (total <= 0) return null
  const last = total - 1
  if (current < last) return current + 1
  if (loop && last >= 0) return 0
  return null
}
