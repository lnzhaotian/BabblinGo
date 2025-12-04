import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/app/theme-context'
import { LexicalContent } from '@/components/LexicalContent'
import { QuestionDoc } from '@/lib/testing-types'
import { Ionicons } from '@expo/vector-icons'
import { resolveMediaUrl } from '@/lib/payload'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, SharedValue } from 'react-native-reanimated'
import SingleTrackPlayer from '@/components/SingleTrackPlayer'
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio'
import { uploadMedia } from '@/lib/testing-api'

type QuestionRendererProps = {
  question: QuestionDoc
  onAnswerChange: (answer: any) => void
  submitted?: boolean
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  onAnswerChange,
  submitted = false,
}) => {
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'

  // Reset state when question changes
  useEffect(() => {
    // Reset logic if needed, but parent usually handles keying
  }, [question.id])

  const renderContent = () => {
    switch (question.type) {
      case 'multiple_choice':
      case 'reading_comprehension': // Often similar to MCQ
      case 'listening_comprehension': // Often similar to MCQ
        return (
          <MultipleChoice
            question={question}
            onAnswerChange={onAnswerChange}
            disabled={submitted}
            isDark={isDark}
          />
        )
      case 'fill_blank':
        return (
          <FillBlank
            question={question}
            onAnswerChange={onAnswerChange}
            disabled={submitted}
            isDark={isDark}
          />
        )
      case 'matching':
        return (
          <Matching
            question={question}
            onAnswerChange={onAnswerChange}
            disabled={submitted}
            isDark={isDark}
          />
        )
      case 'speaking':
        return (
          <Speaking
            question={question}
            onAnswerChange={onAnswerChange}
            disabled={submitted}
            isDark={isDark}
          />
        )
      default:
        return (
          <View style={styles.unsupportedContainer}>
            <Text style={[styles.unsupportedText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              Question type &quot;{question.type}&quot; is not yet supported in this version.
            </Text>
          </View>
        )
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MediaRenderer media={question.media} isDark={isDark} />
      
      <View style={styles.stemContainer}>
        <LexicalContent content={question.stem} colorScheme={colorScheme} />
      </View>
      
      <View style={styles.interactionContainer}>
        {renderContent()}
      </View>
    </ScrollView>
  )
}

const MediaRenderer = ({ media, isDark }: { media: any, isDark: boolean }) => {
    if (!media) return null
    const url = resolveMediaUrl(media)
    if (!url) return null
    
    // Check mime type or extension
    const isAudio = media.mimeType?.startsWith('audio') || url.endsWith('.mp3') || url.endsWith('.m4a') || url.endsWith('.wav')
    const isImage = media.mimeType?.startsWith('image') || url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.webp')
    
    if (isAudio) {
        return (
            <View style={{ marginBottom: 16, backgroundColor: isDark ? '#18181b' : '#f8fafc', borderRadius: 12, padding: 8 }}>
                <SingleTrackPlayer
                    track={{ id: media.id, title: media.alt || 'Audio', audioUrl: url }}
                    speed={1.0}
                    loop={false}
                    onSpeedChange={() => {}}
                    showSpeedControls={false}
                    showNavigationControls={false}
                />
            </View>
        )
    }
    
    if (isImage) {
        return (
            <Image 
                source={{ uri: url }} 
                style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 16 }} 
                resizeMode="contain" 
            />
        )
    }
    
    return null
}

const Speaking = ({
  question,
  onAnswerChange,
  disabled,
  isDark,
}: {
  question: QuestionDoc
  onAnswerChange: (val: string) => void
  disabled: boolean
  isDark: boolean
}) => {
    const [isRecording, setIsRecording] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
        // status update
    })

    const handleRecordPress = async () => {
        if (isRecording) {
            await audioRecorder.stop()
            
            // Small delay to ensure file is finalized
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            setIsRecording(false)
            
            if (audioRecorder.uri) {
                const uri = audioRecorder.uri
                
                setIsUploading(true)
                try {
                    const result = await uploadMedia(uri)
                    const mediaUrl = result.doc.url || result.doc.filename
                    onAnswerChange(mediaUrl)
                } catch (e) {
                    console.error("Upload failed", e)
                    alert("Failed to upload recording. Please try again.")
                } finally {
                    setIsUploading(false)
                }
            }
        } else {
            try {
                const { granted } = await requestRecordingPermissionsAsync()
                if (!granted) {
                    alert("Microphone permission is required.")
                    return
                }

                await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
                await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY)
                await audioRecorder.record()
                setIsRecording(true)
            } catch (e) {
                console.error("Failed to start recording", e)
                alert("Failed to start recording. Please check microphone permissions.")
            }
        }
    }

    return (
        <View style={{ padding: 20, alignItems: 'center', gap: 20 }}>
            <Text style={{ color: isDark ? '#fff' : '#000', textAlign: 'center', fontSize: 16 }}>
                {question.speakingReference || "Tap the microphone and speak the text above."}
            </Text>
            <TouchableOpacity 
                style={{ 
                    backgroundColor: disabled ? (isDark ? '#334155' : '#cbd5e1') : (isRecording ? '#ef4444' : '#3b82f6'), 
                    width: 80, 
                    height: 80, 
                    borderRadius: 40, 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                    elevation: 8,
                    opacity: isUploading ? 0.5 : 1
                }}
                onPress={handleRecordPress}
                disabled={disabled || isUploading}
            >
                {isUploading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Ionicons name={isRecording ? "stop" : "mic"} size={40} color="#fff" />
                )}
            </TouchableOpacity>
            <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {disabled ? "Recorded" : (isUploading ? "Uploading..." : (isRecording ? "Tap to Stop" : "Tap to Record"))}
            </Text>
        </View>
    )
}

const MultipleChoice = ({
  question,
  onAnswerChange,
  disabled,
  isDark,
}: {
  question: QuestionDoc
  onAnswerChange: (val: number) => void
  disabled: boolean
  isDark: boolean
}) => {
  const [selectedindex, setSelectedIndex] = useState<number | null>(null)

  const handleSelect = (index: number) => {
    if (disabled) return
    setSelectedIndex(index)
    onAnswerChange(index)
  }

  return (
    <View style={styles.optionsContainer}>
      {question.options?.map((option, index) => {
        const isSelected = selectedindex === index
        const borderColor = isSelected 
          ? (isDark ? '#60a5fa' : '#2563eb') 
          : (isDark ? '#334155' : '#e2e8f0')
        const bgColor = isSelected
          ? (isDark ? '#1e3a8a' : '#eff6ff')
          : (isDark ? '#18181b' : '#fff')

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              { 
                borderColor, 
                backgroundColor: bgColor,
                borderWidth: isSelected ? 2 : 1
              }
            ]}
            onPress={() => handleSelect(index)}
            disabled={disabled}
          >
            <View style={[
              styles.optionCircle,
              { 
                borderColor: isSelected ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#94a3b8' : '#cbd5e1'),
                backgroundColor: isSelected ? (isDark ? '#60a5fa' : '#2563eb') : 'transparent'
              }
            ]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={[
              styles.optionText, 
              { color: isDark ? '#f1f5f9' : '#18181b' }
            ]}>
              {option.text}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const FillBlank = ({
  question,
  onAnswerChange,
  disabled,
  isDark,
}: {
  question: QuestionDoc
  onAnswerChange: (val: string[]) => void
  disabled: boolean
  isDark: boolean
}) => {
  // Initialize with empty strings for each blank
  const [answers, setAnswers] = useState<string[]>(
    new Array(question.blanks?.length || 1).fill('')
  )

  const handleChange = (text: string, index: number) => {
    const newAnswers = [...answers]
    newAnswers[index] = text
    setAnswers(newAnswers)
    onAnswerChange(newAnswers)
  }

  const { t } = useTranslation()

  return (
    <View style={styles.blanksContainer}>
      {answers.map((ans, index) => (
        <View key={index} style={styles.blankItem}>
          <Text style={[styles.blankLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {t('tests.question.fillBlank')} {index + 1}
          </Text>
          <TextInput
            style={[
              styles.input,
              { 
                color: isDark ? '#f1f5f9' : '#18181b',
                backgroundColor: isDark ? '#18181b' : '#fff',
                borderColor: isDark ? '#334155' : '#cbd5e1'
              }
            ]}
            value={ans}
            onChangeText={(text) => handleChange(text, index)}
            editable={!disabled}
            placeholder={t('tests.question.typePlaceholder')}
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          />
        </View>
      ))}
    </View>
  )
}

const StaticLine = ({ start, end, color }: { start: {x: number, y: number}, end: {x: number, y: number}, color: string }) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  
  return (
    <View style={{
      position: 'absolute',
      left: (start.x + end.x) / 2 - length / 2,
      top: (start.y + end.y) / 2 - 1,
      width: length,
      height: 2,
      backgroundColor: color,
      transform: [{ rotate: `${angle}rad` }],
      pointerEvents: 'none',
      zIndex: 5,
    }} />
  )
}

const ActiveLine = ({ start, endX, endY }: { start: {x: number, y: number}, endX: SharedValue<number>, endY: SharedValue<number> }) => {
  const style = useAnimatedStyle(() => {
    const dx = endX.value - start.x
    const dy = endY.value - start.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    return {
      left: (start.x + endX.value) / 2 - length / 2,
      top: (start.y + endY.value) / 2 - 1,
      width: length,
      height: 2,
      transform: [{ rotate: `${angle}rad` }]
    }
  })
  
  return <Animated.View style={[{ position: 'absolute', backgroundColor: '#3b82f6', pointerEvents: 'none', zIndex: 10 }, style]} />
}

const shuffleArray = (array: number[]) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

const Matching = ({
  question,
  onAnswerChange,
  disabled,
  isDark,
}: {
  question: QuestionDoc
  onAnswerChange: (val: Record<number, number>) => void
  disabled: boolean
  isDark: boolean
}) => {
  const [pairs, setPairs] = useState<Record<number, number>>({})
  const [leftCoords, setLeftCoords] = useState<Record<number, {x: number, y: number}>>({})
  const [rightCoords, setRightCoords] = useState<Record<number, {x: number, y: number}>>({})
  const [leftItemBounds, setLeftItemBounds] = useState<Record<number, {x: number, y: number, width: number, height: number}>>({})
  const [rightItemBounds, setRightItemBounds] = useState<Record<number, {x: number, y: number, width: number, height: number}>>({})
  const [activeDrag, setActiveDrag] = useState<{ startSide: 'left' | 'right', index: number, startPoint: {x: number, y: number} } | null>(null)
  
  const containerRef = useRef<View>(null)
  const leftDotRefs = useRef<Map<number, View>>(new Map())
  const rightDotRefs = useRef<Map<number, View>>(new Map())
  const leftItemRefs = useRef<Map<number, View>>(new Map())
  const rightItemRefs = useRef<Map<number, View>>(new Map())

  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const dragStartX = useSharedValue(0)
  const dragStartY = useSharedValue(0)
  
  const leftItemLayouts = useSharedValue<Record<number, {x: number, y: number}>>({})
  const rightItemLayouts = useSharedValue<Record<number, {x: number, y: number}>>({})

  const { leftOrder, rightOrder } = React.useMemo(() => {
    const n = question.matchingPairs?.length || 0
    const indices = Array.from({ length: n }, (_, i) => i)
    return {
      leftOrder: shuffleArray(indices),
      rightOrder: shuffleArray(indices),
      // Include id to satisfy linter dependency requirement
      _id: question.id
    }
  }, [question.id, question.matchingPairs?.length])

  // Measure dots on mount/layout
  const measureDots = React.useCallback(() => {
    if (!containerRef.current) return

    const measure = (
        dotMap: Map<number, View>, 
        itemMap: Map<number, View>,
        setDotCoords: React.Dispatch<React.SetStateAction<Record<number, {x: number, y: number}>>>,
        setItemBounds: React.Dispatch<React.SetStateAction<Record<number, {x: number, y: number, width: number, height: number}>>>,
        layoutShared: SharedValue<Record<number, {x: number, y: number}>>
    ) => {
      const coords: Record<number, {x: number, y: number}> = {}
      const bounds: Record<number, {x: number, y: number, width: number, height: number}> = {}
      const layouts: Record<number, {x: number, y: number}> = {}
      let pending = dotMap.size + itemMap.size
      if (pending === 0) return

      dotMap.forEach((view, index) => {
        view.measureLayout(
          containerRef.current!,
          (x, y, width, height) => {
            coords[index] = { x: x + width / 2, y: y + height / 2 }
            pending--
            if (pending === 0) {
              setDotCoords(prev => ({ ...prev, ...coords }))
              setItemBounds(prev => ({ ...prev, ...bounds }))
              layoutShared.value = { ...layoutShared.value, ...layouts }
            }
          },
          () => { pending-- }
        )
      })

      itemMap.forEach((view, index) => {
        view.measureLayout(
            containerRef.current!,
            (x, y, width, height) => {
                layouts[index] = { x, y }
                bounds[index] = { x, y, width, height }
                pending--
                if (pending === 0) {
                    setDotCoords(prev => ({ ...prev, ...coords }))
                    setItemBounds(prev => ({ ...prev, ...bounds }))
                    layoutShared.value = { ...layoutShared.value, ...layouts }
                }
            },
            () => { pending-- }
        )
      })
    }

    // Small delay to ensure layout is ready
    setTimeout(() => {
        measure(leftDotRefs.current, leftItemRefs.current, setLeftCoords, setLeftItemBounds, leftItemLayouts)
        measure(rightDotRefs.current, rightItemRefs.current, setRightCoords, setRightItemBounds, rightItemLayouts)
    }, 100)
  }, [leftItemLayouts, rightItemLayouts])

  useEffect(() => {
    setPairs({})
    measureDots()
  }, [question.id, measureDots])

  const handleConnect = (startSide: 'left' | 'right', startIndex: number, endX: number, endY: number) => {
    const targetCoords = startSide === 'left' ? rightCoords : leftCoords
    const targetBounds = startSide === 'left' ? rightItemBounds : leftItemBounds
    const threshold = 40 // Snap distance for dots

    let foundIndex: string | null = null
    
    // Check dots first (legacy behavior, still good for precision)
    Object.entries(targetCoords).forEach(([indexStr, coord]) => {
      const dx = coord.x - endX
      const dy = coord.y - endY
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        foundIndex = indexStr
      }
    })

    // If not found near dot, check if dropped inside item bounds
    if (foundIndex === null) {
        Object.entries(targetBounds).forEach(([indexStr, bounds]) => {
            if (
                endX >= bounds.x && 
                endX <= bounds.x + bounds.width &&
                endY >= bounds.y &&
                endY <= bounds.y + bounds.height
            ) {
                foundIndex = indexStr
            }
        })
    }

    if (foundIndex !== null) {
      const targetIndex = parseInt(foundIndex, 10)
      const newPairs = { ...pairs }
      
      if (startSide === 'left') {
        // Remove any existing pair for this left item
        // And remove any existing pair for the target right item
        const existingLeftForRight = Object.keys(newPairs).find(k => newPairs[parseInt(k)] === targetIndex)
        if (existingLeftForRight) delete newPairs[parseInt(existingLeftForRight)]
        
        newPairs[startIndex] = targetIndex
      } else {
        // Dragged from right to left
        // Remove any existing pair for this right item (which is startIndex)
        const existingLeftForRight = Object.keys(newPairs).find(k => newPairs[parseInt(k)] === startIndex)
        if (existingLeftForRight) delete newPairs[parseInt(existingLeftForRight)]
        
        // Remove any existing pair for the target left item
        delete newPairs[targetIndex]
        
        newPairs[targetIndex] = startIndex
      }
      
      setPairs(newPairs)
      
      // Translate visual pairs to logical pairs for answer submission
      const logicalPairs: Record<number, number> = {}
      Object.entries(newPairs).forEach(([vLeft, vRight]) => {
          const oLeft = leftOrder[parseInt(vLeft)]
          const oRight = rightOrder[vRight]
          logicalPairs[oLeft] = oRight
      })
      onAnswerChange(logicalPairs)
    }
    
    setActiveDrag(null)
  }

  return (
    <View style={styles.matchingContainer} ref={containerRef} onLayout={measureDots}>
       {/* Render Lines */}
       {Object.entries(pairs).map(([leftIdx, rightIdx]) => {
           const start = leftCoords[parseInt(leftIdx)]
           const end = rightCoords[rightIdx]
           if (start && end) {
               return <StaticLine key={`line-${leftIdx}-${rightIdx}`} start={start} end={end} color={isDark ? '#60a5fa' : '#2563eb'} />
           }
           return null
       })}
       
       {activeDrag && (
           <ActiveLine start={activeDrag.startPoint} endX={dragX} endY={dragY} />
       )}

       <View style={styles.column}>
        <Text style={[styles.columnHeader, { color: isDark ? '#fff' : '#000' }]}>Items</Text>
        {leftOrder.map((originalIndex, index) => {
            const pair = question.matchingPairs![originalIndex]
            const gesture = Gesture.Pan()
                .onStart((e) => {
                    if (disabled) return
                    const startPoint = leftCoords[index]
                    const itemLayout = leftItemLayouts.value[index]
                    if (startPoint && itemLayout) {
                        const startX = itemLayout.x + e.x
                        const startY = itemLayout.y + e.y
                        dragStartX.value = startX
                        dragStartY.value = startY
                        dragX.value = startX
                        dragY.value = startY
                        runOnJS(setActiveDrag)({ startSide: 'left', index, startPoint })
                    }
                })
                .onUpdate((e) => {
                    if (disabled) return
                    dragX.value = dragStartX.value + e.translationX
                    dragY.value = dragStartY.value + e.translationY
                })
                .onEnd((e) => {
                    if (disabled) return
                    runOnJS(handleConnect)('left', index, dragX.value, dragY.value)
                })

            return (
                <View key={`left-${index}`} style={styles.matchItemWrapper}>
                    <GestureDetector gesture={gesture}>
                        <View 
                            style={[
                                styles.matchItem,
                                { 
                                    backgroundColor: isDark ? '#18181b' : '#fff',
                                    borderColor: isDark ? '#334155' : '#e2e8f0'
                                }
                            ]}
                            ref={el => { if(el) leftItemRefs.current.set(index, el) }}
                        >
                            {pair.leftType === 'image' && pair.leftImage ? (
                                <Image 
                                    source={{ uri: resolveMediaUrl(pair.leftImage) || undefined }} 
                                    style={styles.matchImage} 
                                    resizeMode="contain"
                                />
                            ) : (
                                <Text style={{ color: isDark ? '#fff' : '#000' }}>{pair.leftText}</Text>
                            )}
                        </View>
                    </GestureDetector>
                    <View 
                        style={[styles.connectorDot, { backgroundColor: isDark ? '#60a5fa' : '#2563eb', borderColor: isDark ? '#18181b' : '#fff' }]} 
                        ref={el => { if(el) leftDotRefs.current.set(index, el) }}
                    />
                </View>
            )
        })}
      </View>
      
      <View style={styles.column}>
        <Text style={[styles.columnHeader, { color: isDark ? '#fff' : '#000' }]}>Matches</Text>
        {rightOrder.map((originalIndex, index) => {
             const pair = question.matchingPairs![originalIndex]
             const gesture = Gesture.Pan()
                .onStart((e) => {
                    if (disabled) return
                    const startPoint = rightCoords[index]
                    const itemLayout = rightItemLayouts.value[index]
                    if (startPoint && itemLayout) {
                        const startX = itemLayout.x + e.x
                        const startY = itemLayout.y + e.y
                        dragStartX.value = startX
                        dragStartY.value = startY
                        dragX.value = startX
                        dragY.value = startY
                        runOnJS(setActiveDrag)({ startSide: 'right', index, startPoint })
                    }
                })
                .onUpdate((e) => {
                    if (disabled) return
                    dragX.value = dragStartX.value + e.translationX
                    dragY.value = dragStartY.value + e.translationY
                })
                .onEnd((e) => {
                    if (disabled) return
                    runOnJS(handleConnect)('right', index, dragX.value, dragY.value)
                })

             return (
                <View key={`right-${index}`} style={styles.matchItemWrapper}>
                    <View 
                        style={[styles.connectorDot, { left: -8, right: undefined, backgroundColor: isDark ? '#60a5fa' : '#2563eb', borderColor: isDark ? '#18181b' : '#fff' }]} 
                        ref={el => { if(el) rightDotRefs.current.set(index, el) }}
                    />
                    <GestureDetector gesture={gesture}>
                        <View 
                            style={[
                                styles.matchItem,
                                { 
                                    backgroundColor: isDark ? '#18181b' : '#fff',
                                    borderColor: isDark ? '#334155' : '#e2e8f0'
                                }
                            ]}
                            ref={el => { if(el) rightItemRefs.current.set(index, el) }}
                        >
                            {pair.rightType === 'image' && pair.rightImage ? (
                                <Image 
                                    source={{ uri: resolveMediaUrl(pair.rightImage) || undefined }} 
                                    style={styles.matchImage} 
                                    resizeMode="contain"
                                />
                            ) : (
                                <Text style={{ color: isDark ? '#fff' : '#000' }}>{pair.rightText}</Text>
                            )}
                        </View>
                    </GestureDetector>
                </View>
            )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  stemContainer: {
    marginBottom: 24,
  },
  interactionContainer: {
    gap: 16,
  },
  unsupportedContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsupportedText: {
    fontSize: 16,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  optionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  blanksContainer: {
    gap: 16,
  },
  blankItem: {
    gap: 8,
  },
  blankLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  matchingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 60,
    position: 'relative',
  },
  column: {
    flex: 1,
    gap: 12,
  },
  columnHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  matchItemWrapper: {
    position: 'relative',
    marginBottom: 12,
    justifyContent: 'center',
  },
  matchItem: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedMatchItem: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  pairedMatchItem: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  matchImage: {
    width: '100%',
    height: 50,
  },
  connectorDot: {
    position: 'absolute',
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
})
