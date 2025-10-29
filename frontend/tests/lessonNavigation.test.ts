import { describe, it, expect } from "vitest"
import { computeTargetIndex, computeNextOnFinish } from "@/hooks/navigation-helpers"

describe("useLessonNavigation helpers", () => {
  describe("computeTargetIndex (prev/next)", () => {
    it("goes to previous within bounds", () => {
      expect(computeTargetIndex(2, 5, false, "prev")).toBe(1)
    })

    it("stays at 0 on prev when loop=false", () => {
      expect(computeTargetIndex(0, 5, false, "prev")).toBe(0)
    })

    it("wraps to last on prev when loop=true", () => {
      expect(computeTargetIndex(0, 3, true, "prev")).toBe(2)
    })

    it("advances to next within bounds", () => {
      expect(computeTargetIndex(1, 4, false, "next")).toBe(2)
    })

    it("stays at last on next when loop=false", () => {
      expect(computeTargetIndex(3, 4, false, "next")).toBe(3)
    })

    it("wraps to 0 on next when loop=true", () => {
      expect(computeTargetIndex(2, 3, true, "next")).toBe(0)
    })
  })

  describe("computeNextOnFinish", () => {
    it("moves to next until last", () => {
      expect(computeNextOnFinish(1, 3, false)).toBe(2)
    })
    it("returns null at end if loop=false", () => {
      expect(computeNextOnFinish(2, 3, false)).toBeNull()
    })
    it("wraps to 0 at end if loop=true", () => {
      expect(computeNextOnFinish(2, 3, true)).toBe(0)
    })
    it("returns null when total is 0", () => {
      expect(computeNextOnFinish(0, 0, true)).toBeNull()
    })
  })

  describe("edge cases", () => {
    it("keeps current when total=0 for prev/next", () => {
      expect(computeTargetIndex(0, 0, false, "prev")).toBe(0)
      expect(computeTargetIndex(0, 0, true, "next")).toBe(0)
    })
    it("single-slide behavior without loop", () => {
      expect(computeTargetIndex(0, 1, false, "next")).toBe(0)
      expect(computeTargetIndex(0, 1, false, "prev")).toBe(0)
      expect(computeNextOnFinish(0, 1, false)).toBeNull()
    })
    it("single-slide behavior with loop", () => {
      expect(computeTargetIndex(0, 1, true, "next")).toBe(0)
      expect(computeTargetIndex(0, 1, true, "prev")).toBe(0)
      expect(computeNextOnFinish(0, 1, true)).toBe(0)
    })
  })
})
