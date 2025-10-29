import { useCallback, useEffect, useRef, useState } from "react"
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import { computeTargetIndex, computeNextOnFinish, type NavigateAction } from "@/hooks/navigation-helpers"
export type { NavigateAction }

interface UseLessonNavigationParams {
  totalSlides: number
  hasAudio: boolean[]
  loopEnabled: boolean
  dwellMs?: number
}

export function useLessonNavigation({ totalSlides, hasAudio, loopEnabled, dwellMs = 2500 }: UseLessonNavigationParams) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const { width: screenWidth } = Dimensions.get("window")
  const programmaticScrollRef = useRef(false)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep index in bounds if slide count changes
  useEffect(() => {
    if (currentSlideIndex >= totalSlides) {
      setCurrentSlideIndex(Math.max(0, totalSlides - 1))
    }
  }, [totalSlides, currentSlideIndex])

  // Auto-advance silent slides
  useEffect(() => {
    if (totalSlides === 0) return
    // Clear any existing timer
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }

    // If current slide has audio, do nothing
    if (hasAudio[currentSlideIndex]) return

    const nextIndex = currentSlideIndex + 1
    if (nextIndex >= totalSlides) return

    dwellTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = true
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true })
      setCurrentSlideIndex(nextIndex)
    }, dwellMs)

    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current)
        dwellTimerRef.current = null
      }
    }
  }, [currentSlideIndex, totalSlides, hasAudio, dwellMs])

  const onSlideScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / screenWidth)
    setCurrentSlideIndex(index)
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false
      return
    }
  }, [screenWidth])

  const handleNavigate = useCallback((action: NavigateAction) => {
  const target = computeTargetIndex(currentSlideIndex, totalSlides, loopEnabled, action)
    if (target !== currentSlideIndex) {
      programmaticScrollRef.current = true
      flatListRef.current?.scrollToIndex({ index: target, animated: true })
      setCurrentSlideIndex(target)
    }
  }, [currentSlideIndex, totalSlides, loopEnabled])

  const handleTrackFinish = useCallback(() => {
  const next = computeNextOnFinish(currentSlideIndex, totalSlides, loopEnabled)
    if (next === null) return
    programmaticScrollRef.current = true
    flatListRef.current?.scrollToIndex({ index: next, animated: true })
    setCurrentSlideIndex(next)
  }, [currentSlideIndex, totalSlides, loopEnabled])

  return {
    currentSlideIndex,
    setCurrentSlideIndex,
    flatListRef,
    screenWidth,
    onSlideScroll,
    handleNavigate,
    handleTrackFinish,
  }
}
