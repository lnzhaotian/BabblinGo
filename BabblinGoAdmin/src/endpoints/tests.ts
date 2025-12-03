// @ts-nocheck
import type { PayloadHandler, CollectionSlug } from 'payload'

export const startTestHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { blueprintId } = body

  if (!blueprintId) {
    return new Response('Missing blueprintId', { status: 400 })
  }

  try {
    const blueprint = await req.payload.findByID({
      collection: 'test-blueprints' as unknown as CollectionSlug,
      id: blueprintId,
    }) as any

    if (!blueprint) {
      return new Response('Blueprint not found', { status: 404 })
    }

    // Create Session
    const session = await req.payload.create({
      collection: 'test-sessions' as unknown as CollectionSlug,
      data: {
        user: req.user.id,
        blueprint: blueprintId,
        status: 'started',
        startTime: new Date().toISOString(),
        history: [],
        questionnaireAnswers: [],
        currentEstimate: {}, // Initial state
      },
    }) as any

    // Check for Pre-Test Questionnaire
    if (blueprint.preTestQuestionnaire) {
        const questionnaireId = typeof blueprint.preTestQuestionnaire === 'string' ? blueprint.preTestQuestionnaire : blueprint.preTestQuestionnaire.id
        const questionnaire = await req.payload.findByID({
            collection: 'questionnaires' as unknown as CollectionSlug,
            id: questionnaireId,
        })

        return Response.json({
            sessionId: session.id,
            type: 'questionnaire',
            data: questionnaire,
        })
    }

    // Determine first question based on strategy
    let firstQuestionId: string | null = null

    if (blueprint.strategy === 'linear') {
      const questions = blueprint.linearQuestions || []
      if (questions.length > 0) {
        firstQuestionId = typeof questions[0] === 'string' ? questions[0] : questions[0].id
      }
    } else if (blueprint.strategy === 'randomized_pool') {
        const poolConfig = blueprint.poolConfig || {}
        const poolSize = poolConfig.poolSize || 10
        
        // Fetch candidates
        // TODO: Add proper filtering based on tags/difficulty
        const candidates = await req.payload.find({
            collection: 'question-bank' as unknown as CollectionSlug,
            limit: 100, 
        })

        if (candidates.docs.length > 0) {
            // Shuffle and slice
            const shuffled = candidates.docs.sort(() => 0.5 - Math.random())
            const selected = shuffled.slice(0, poolSize)
            const selectedIds = selected.map((q: any) => q.id)
            
            // Save to session
            await req.payload.update({
                collection: 'test-sessions' as unknown as CollectionSlug,
                id: session.id,
                data: {
                    generatedQuestions: selectedIds
                }
            })
            
            firstQuestionId = selectedIds[0]
        }
    } else if (blueprint.strategy === 'adaptive_rule_based') {
        const adaptiveConfig = blueprint.adaptiveConfig || {}
        const initialDifficulty = adaptiveConfig.initialDifficulty || 3 // Default B1
        const standard = adaptiveConfig.difficultyStandard || 'cefr'
        
        let query: any = {}
        
        if (standard === 'actfl') {
            const actflLevels = [
                'novice_low', 'novice_mid', 'novice_high',
                'intermediate_low', 'intermediate_mid', 'intermediate_high',
                'advanced_low', 'advanced_mid', 'advanced_high',
                'superior', 'distinguished'
            ]
            const targetLevel = actflLevels[initialDifficulty - 1] || 'novice_high'
            query = { difficulty_actfl: { equals: targetLevel } }
        } else {
            const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
            const targetLevel = cefrLevels[initialDifficulty - 1] || 'B1'
            query = { difficulty_cefr: { equals: targetLevel } }
        }
        
        const candidates = await req.payload.find({
            collection: 'question-bank' as unknown as CollectionSlug,
            where: query,
            limit: 10,
        })
        
        if (candidates.docs.length > 0) {
            const randomQ = candidates.docs[Math.floor(Math.random() * candidates.docs.length)]
            firstQuestionId = randomQ.id
            
            // Initialize estimate
            await req.payload.update({
                collection: 'test-sessions' as unknown as CollectionSlug,
                id: session.id,
                data: {
                    currentEstimate: {
                        level: initialDifficulty,
                        questionsCount: 0
                    }
                }
            })
        } else {
             // Fallback: If no questions found at exact level, try +/- 1 level
             // For now, just return error but maybe we should be smarter
             console.warn(`No questions found for adaptive start. Standard: ${standard}, Level: ${initialDifficulty}`)
        }
    } else {
      // TODO: Implement other strategies
      return new Response('Strategy not implemented yet', { status: 501 })
    }

    if (!firstQuestionId) {
      return new Response('No questions found for this test', { status: 400 })
    }

    const question = await req.payload.findByID({
      collection: 'question-bank' as unknown as CollectionSlug,
      id: firstQuestionId,
    }) as any

    return Response.json({
      sessionId: session.id,
      type: 'question',
      data: question,
    })

  } catch (error) {
    console.error('Start Test Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const submitAnswerHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { sessionId, questionId, questionnaireId, answer, answers, timeTaken } = body

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 })
  }

  try {
    const session = await req.payload.findByID({
      collection: 'test-sessions' as unknown as CollectionSlug,
      id: sessionId,
    }) as any

    if (!session) {
      return new Response('Session not found', { status: 404 })
    }

    if (session.status !== 'started') {
      return new Response('Session is not active', { status: 400 })
    }

    const blueprint = await req.payload.findByID({
      collection: 'test-blueprints' as unknown as CollectionSlug,
      id: typeof session.blueprint === 'object' ? session.blueprint.id : session.blueprint,
    }) as any

    // Handle Questionnaire Submission
    if (questionnaireId) {
        if (!answers) return new Response('Missing answers for questionnaire', { status: 400 })
        
        const newAnswer = {
            questionnaire: questionnaireId,
            answers: answers,
        }
        
        await req.payload.update({
            collection: 'test-sessions' as unknown as CollectionSlug,
            id: sessionId,
            data: {
                questionnaireAnswers: [...(session.questionnaireAnswers || []), newAnswer]
            }
        })

        // Determine what's next after questionnaire
        // If it was pre-test, go to first question
        // If it was post-test, finish session
        
        const preTestId = blueprint.preTestQuestionnaire ? (typeof blueprint.preTestQuestionnaire === 'string' ? blueprint.preTestQuestionnaire : blueprint.preTestQuestionnaire.id) : null
        const postTestId = blueprint.postTestQuestionnaire ? (typeof blueprint.postTestQuestionnaire === 'string' ? blueprint.postTestQuestionnaire : blueprint.postTestQuestionnaire.id) : null

        if (questionnaireId === preTestId) {
            // Start the actual test
            let firstQuestionId: string | null = null
            if (blueprint.strategy === 'linear') {
                const questions = blueprint.linearQuestions || []
                if (questions.length > 0) {
                    firstQuestionId = typeof questions[0] === 'string' ? questions[0] : questions[0].id
                }
            } else if (blueprint.strategy === 'randomized_pool') {
                const poolConfig = blueprint.poolConfig || {}
                const poolSize = poolConfig.poolSize || 10
                
                const candidates = await req.payload.find({
                    collection: 'question-bank' as unknown as CollectionSlug,
                    limit: 100, 
                })

                if (candidates.docs.length > 0) {
                    const shuffled = candidates.docs.sort(() => 0.5 - Math.random())
                    const selected = shuffled.slice(0, poolSize)
                    const selectedIds = selected.map((q: any) => q.id)
                    
                    await req.payload.update({
                        collection: 'test-sessions' as unknown as CollectionSlug,
                        id: sessionId,
                        data: {
                            generatedQuestions: selectedIds
                        }
                    })
                    
                    firstQuestionId = selectedIds[0]
                }
            } else if (blueprint.strategy === 'adaptive_rule_based') {
                const adaptiveConfig = blueprint.adaptiveConfig || {}
                const initialDifficulty = adaptiveConfig.initialDifficulty || 3
                const standard = adaptiveConfig.difficultyStandard || 'cefr'
                
                let query: Record<string, unknown> = {}
                
                if (standard === 'actfl') {
                    const actflLevels = [
                        'novice_low', 'novice_mid', 'novice_high',
                        'intermediate_low', 'intermediate_mid', 'intermediate_high',
                        'advanced_low', 'advanced_mid', 'advanced_high',
                        'superior', 'distinguished'
                    ]
                    const targetLevel = actflLevels[initialDifficulty - 1] || 'novice_high'
                    query = { difficulty_actfl: { equals: targetLevel } }
                } else {
                    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
                    const targetLevel = cefrLevels[initialDifficulty - 1] || 'B1'
                    query = { difficulty_cefr: { equals: targetLevel } }
                }
                
                const candidates = await req.payload.find({
                    collection: 'question-bank' as unknown as CollectionSlug,
                    where: query,
                    limit: 10,
                })
                
                if (candidates.docs.length > 0) {
                    const randomQ = candidates.docs[Math.floor(Math.random() * candidates.docs.length)]
                    firstQuestionId = randomQ.id
                    
                    await req.payload.update({
                        collection: 'test-sessions' as unknown as CollectionSlug,
                        id: sessionId,
                        data: {
                            currentEstimate: {
                                level: initialDifficulty,
                                questionsCount: 0
                            }
                        }
                    })
                } else {
                    // Fallback: If no questions found at exact level, try to find ANY question
                    // This prevents "No questions found" error if the bank has questions but not at this specific level
                    const fallbackCandidates = await req.payload.find({
                        collection: 'question-bank' as unknown as CollectionSlug,
                        limit: 10,
                    })

                    if (fallbackCandidates.docs.length > 0) {
                        const randomQ = fallbackCandidates.docs[Math.floor(Math.random() * fallbackCandidates.docs.length)]
                        firstQuestionId = randomQ.id
                        
                        // We keep the initial difficulty estimate even if the question doesn't match,
                        // or we could update it. For now, let's keep it simple.
                        await req.payload.update({
                            collection: 'test-sessions' as unknown as CollectionSlug,
                            id: sessionId,
                            data: {
                                currentEstimate: {
                                    level: initialDifficulty,
                                    questionsCount: 0
                                }
                            }
                        })
                    }
                }
            }
            
            if (firstQuestionId) {
                const question = await req.payload.findByID({
                    collection: 'question-bank' as unknown as CollectionSlug,
                    id: firstQuestionId,
                })
                return Response.json({
                    status: 'continue',
                    type: 'question',
                    data: question
                })
            } else {
                 // If no questions found, we should probably finish the test gracefully or error out
                 // But for now, let's return a 400 as before, but maybe the frontend can handle it better
                 // Or better yet, if it's adaptive and no questions found, maybe we just finish?
                 // But this is the START of the test (after questionnaire). If no questions, it's a broken test.
                 return new Response('No questions found for this test', { status: 400 })
            }
        } else if (questionnaireId === postTestId) {
            // Finish session
             await req.payload.update({
                collection: 'test-sessions' as unknown as CollectionSlug,
                id: sessionId,
                data: {
                    status: 'completed',
                    endTime: new Date().toISOString(),
                    // Final result should have been calculated before post-test questionnaire? 
                    // Or we calculate it now if not done.
                },
            })
            return Response.json({
                status: 'completed',
                result: session.finalResult // Assuming it was calculated before
            })
        }
    }

    // Handle Question Submission
    if (questionId) {
        if (answer === undefined) return new Response('Missing answer', { status: 400 })

        const question = await req.payload.findByID({
        collection: 'question-bank' as unknown as CollectionSlug,
        id: questionId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any

        // Validate Answer
        let isCorrect = false
        let score = 0
        let finalAnswer = answer
        
        // Validation logic based on type
        if (['multiple_choice', 'listening_comprehension', 'reading_comprehension'].includes(question.type)) {
            if (typeof answer === 'number' && question.options && question.options[answer]) {
                isCorrect = question.options[answer].isCorrect === true
            }
        } else if (question.type === 'fill_blank') {
            const userAnswers = Array.isArray(answer) ? answer : [answer]
            if (question.blanks && question.blanks.length > 0) {
                let allCorrect = true
                for (let i = 0; i < question.blanks.length; i++) {
                    const correctString = question.blanks[i].acceptedAnswers || ''
                    const accepted = correctString.split('|').map((s: string) => s.trim().toLowerCase())
                    const userVal = (userAnswers[i] || '').trim().toLowerCase()
                    if (!accepted.includes(userVal)) {
                        allCorrect = false
                        break
                    }
                }
                isCorrect = allCorrect
            }
        } else if (question.type === 'matching') {
             // Wrap answer to avoid Payload validation issues with numeric keys in JSON fields
             if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
                 finalAnswer = { pairs: answer }
             }

             // Validate Matching Logic
             // The frontend sends { [leftIndex]: rightIndex }
             // Correct match is when leftIndex == rightIndex (assuming matchingPairs are aligned)
             if (answer && typeof answer === 'object') {
                 let correctCount = 0
                 const totalPairs = question.matchingPairs ? question.matchingPairs.length : 0
                 
                 Object.entries(answer).forEach(([leftIdx, rightIdx]) => {
                     // Ensure we are comparing numbers
                     if (parseInt(leftIdx) === Number(rightIdx)) {
                         correctCount++
                     }
                 })
                 
                 // Require all pairs to be correct for now
                 if (totalPairs > 0 && correctCount === totalPairs) {
                     isCorrect = true
                 }
             }
        } else if (question.type === 'speaking') {
            if (answer) isCorrect = true 
        }

        if (isCorrect) score = 1 // Default score

        // Ensure finalAnswer is stored as an object if it's a primitive
        // Payload JSON field requires an Object or Array, primitives like numbers fail validation
        if (typeof finalAnswer !== 'object' || finalAnswer === null) {
            finalAnswer = { value: finalAnswer }
        }

        // Generate Readable Answer
        let readableAnswer = ''
        try {
            if (['multiple_choice', 'listening_comprehension', 'reading_comprehension'].includes(question.type)) {
                const val = (typeof finalAnswer === 'object' && finalAnswer.value !== undefined) ? finalAnswer.value : finalAnswer
                if (question.options && question.options[val]) {
                    readableAnswer = question.options[val].text
                } else {
                    readableAnswer = `Option ${Number(val) + 1}`
                }
            } else if (question.type === 'matching') {
                if (finalAnswer.pairs) {
                    readableAnswer = Object.entries(finalAnswer.pairs)
                        .map(([k, v]) => {
                            const kIdx = parseInt(k)
                            const vIdx = Number(v)
                            const left = question.matchingPairs?.[kIdx]?.leftText || `Left ${kIdx + 1}`
                            const right = question.matchingPairs?.[vIdx]?.rightText || `Right ${vIdx + 1}`
                            return `${left} -> ${right}`
                        })
                        .join('; ')
                }
            } else if (question.type === 'fill_blank') {
                if (Array.isArray(finalAnswer)) {
                    readableAnswer = finalAnswer.join(', ')
                } else if (typeof finalAnswer === 'object' && Array.isArray(finalAnswer.value)) {
                     readableAnswer = finalAnswer.value.join(', ')
                }
            } else {
                readableAnswer = JSON.stringify(finalAnswer)
            }
        } catch (_e) {
            readableAnswer = JSON.stringify(finalAnswer)
        }

        // Extract tags
        const tags = (question.tags || []).map((t: { tag: string }) => t.tag)

        // Update Session History
        const newHistoryItem = {
        question: questionId,
        tags,
        userAnswer: finalAnswer,
        readableAnswer,
        isCorrect,
        timeTaken: timeTaken || 0,
        awardedScore: score,
        timestamp: new Date().toISOString(),
        }

        // Sanitize existing history to ensure relationships are IDs and not objects
        const existingHistory = (session.history || []).map((item: { id: string; question: string | { id: string }; tags: unknown; userAnswer: unknown; readableAnswer: unknown; isCorrect: boolean; timeTaken: number; awardedScore: number; timestamp: string }) => ({
          id: item.id,
          question: typeof item.question === 'object' ? item.question.id : item.question,
          tags: item.tags,
          userAnswer: item.userAnswer,
          readableAnswer: item.readableAnswer,
          isCorrect: item.isCorrect,
          timeTaken: item.timeTaken,
          awardedScore: item.awardedScore,
          timestamp: item.timestamp,
        }))

        const updatedHistory = [...existingHistory, newHistoryItem]

        console.log('Updating history with:', JSON.stringify(newHistoryItem, null, 2))

        await req.payload.update({
        collection: 'test-sessions' as unknown as CollectionSlug,
        id: sessionId,
        data: {
            history: updatedHistory,
        },
        })

        // Determine Next Step
        let nextQuestionId: string | null = null
        let isFinished = false
        let finalAdaptiveLevel: number | undefined

        if (blueprint.strategy === 'linear') {
        const questions = blueprint.linearQuestions || []
        // Map objects to IDs if necessary
        const questionIds = questions.map((q: string | { id: string }) => typeof q === 'string' ? q : q.id)
        const currentIndex = questionIds.indexOf(questionId)
        
        if (currentIndex !== -1 && currentIndex < questionIds.length - 1) {
            nextQuestionId = questionIds[currentIndex + 1]
        } else {
            isFinished = true
        }
        } else if (blueprint.strategy === 'randomized_pool') {
             const generatedQuestions = session.generatedQuestions || []
             const questionIds = generatedQuestions.map((q: string | { id: string }) => typeof q === 'string' ? q : q.id)
             const currentIndex = questionIds.indexOf(questionId)
             
             if (currentIndex !== -1 && currentIndex < questionIds.length - 1) {
                 nextQuestionId = questionIds[currentIndex + 1]
             } else {
                 isFinished = true
             }
        } else if (blueprint.strategy === 'adaptive_rule_based') {
             const adaptiveConfig = blueprint.adaptiveConfig || {}
             const maxQuestions = adaptiveConfig.maxQuestions || 20
             const standard = adaptiveConfig.difficultyStandard || 'cefr'
             const currentEstimate = session.currentEstimate || { level: 3, questionsCount: 0 }
             
             let newLevel = currentEstimate.level
             const maxLevel = standard === 'actfl' ? 11 : 6
             
             // Simple adaptive logic: Correct -> +1, Incorrect -> -1
             if (isCorrect) {
                 newLevel = Math.min(maxLevel, newLevel + 1)
             } else {
                 newLevel = Math.max(1, newLevel - 1)
             }
             
             finalAdaptiveLevel = newLevel
             
             const newCount = (currentEstimate.questionsCount || 0) + 1
             
             // Update estimate
             await req.payload.update({
                 collection: 'test-sessions' as unknown as CollectionSlug,
                 id: sessionId,
                 data: {
                     currentEstimate: {
                         level: newLevel,
                         questionsCount: newCount
                     }
                 }
             })
             
             if (newCount >= maxQuestions) {
                 isFinished = true
             } else {
                 // Find next question at newLevel
                 let query: Record<string, unknown> = {}
                 
                 if (standard === 'actfl') {
                    const actflLevels = [
                        'novice_low', 'novice_mid', 'novice_high',
                        'intermediate_low', 'intermediate_mid', 'intermediate_high',
                        'advanced_low', 'advanced_mid', 'advanced_high',
                        'superior', 'distinguished'
                    ]
                    const targetLevel = actflLevels[newLevel - 1] || 'novice_high'
                    query = { difficulty_actfl: { equals: targetLevel } }
                 } else {
                    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
                    const targetLevel = cefrLevels[newLevel - 1] || 'B1'
                    query = { difficulty_cefr: { equals: targetLevel } }
                 }
                 
                 // Exclude already answered questions
                 const answeredIds = updatedHistory.map((h: { question: string | { id: string } }) => typeof h.question === 'string' ? h.question : h.question.id)
                 
                 const candidates = await req.payload.find({
                    collection: 'question-bank' as unknown as CollectionSlug,
                    where: {
                        and: [
                            query,
                            { id: { not_in: answeredIds } }
                        ]
                    },
                    limit: 10,
                })
                
                if (candidates.docs.length > 0) {
                    const randomQ = candidates.docs[Math.floor(Math.random() * candidates.docs.length)]
                    nextQuestionId = randomQ.id
                } else {
                    // No more questions at this level? Maybe finish or fallback?
                    isFinished = true
                }
             }
        }

        if (isFinished) {
            // Calculate Final Result
            const totalScore = updatedHistory.reduce((sum: number, item: { awardedScore?: number }) => sum + (item.awardedScore || 0), 0)
            
            // Calculate Skill Breakdown
            const skillBreakdown: Record<string, { correct: number, total: number }> = {}
            
            updatedHistory.forEach((item: { tags?: string[], isCorrect?: boolean }) => {
                const itemTags = item.tags || []
                itemTags.forEach((tag: string) => {
                    if (!skillBreakdown[tag]) {
                        skillBreakdown[tag] = { correct: 0, total: 0 }
                    }
                    skillBreakdown[tag].total += 1
                    if (item.isCorrect) {
                        skillBreakdown[tag].correct += 1
                    }
                })
            })

            const finalResult: Record<string, unknown> = {
                score: totalScore,
                maxScore: updatedHistory.length, 
                passed: totalScore / updatedHistory.length > 0.6, 
                skillBreakdown,
            }

            if (finalAdaptiveLevel) {
                 const standard = (blueprint.adaptiveConfig?.difficultyStandard || 'cefr') as 'cefr' | 'actfl'
                 let levelCode = ''
                 if (standard === 'actfl') {
                    const actflLevels = [
                        'novice_low', 'novice_mid', 'novice_high',
                        'intermediate_low', 'intermediate_mid', 'intermediate_high',
                        'advanced_low', 'advanced_mid', 'advanced_high',
                        'superior', 'distinguished'
                    ]
                    levelCode = actflLevels[finalAdaptiveLevel - 1] || 'novice_high'
                 } else {
                    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
                    levelCode = cefrLevels[finalAdaptiveLevel - 1] || 'B1'
                 }
                 
                 const descQuery: Record<string, unknown> = {
                     standard: { equals: standard }
                 }
                 if (standard === 'actfl') {
                     descQuery.level_actfl = { equals: levelCode }
                 } else {
                     descQuery.level_cefr = { equals: levelCode }
                 }

                 const descriptions = await req.payload.find({
                     collection: 'level-descriptions' as unknown as CollectionSlug,
                     where: descQuery,
                 })

                 if (descriptions.docs.length > 0) {
                     const desc = descriptions.docs[0] as unknown as { title: string; description: unknown }
                     finalResult.levelTitle = desc.title
                     finalResult.levelDescription = desc.description
                 }
                 finalResult.level = levelCode
            }

            // Check for Post-Test Questionnaire
            if (blueprint.postTestQuestionnaire) {
                 // Save result but don't complete session yet
                 await req.payload.update({
                    collection: 'test-sessions' as unknown as CollectionSlug,
                    id: sessionId,
                    data: {
                        finalResult,
                    },
                })

                const questionnaireId = typeof blueprint.postTestQuestionnaire === 'string' ? blueprint.postTestQuestionnaire : blueprint.postTestQuestionnaire.id
                const questionnaire = await req.payload.findByID({
                    collection: 'questionnaires' as unknown as CollectionSlug,
                    id: questionnaireId,
                })

                return Response.json({
                    status: 'continue',
                    type: 'questionnaire',
                    data: questionnaire,
                })
            }

            await req.payload.update({
                collection: 'test-sessions' as unknown as CollectionSlug,
                id: sessionId,
                data: {
                status: 'completed',
                endTime: new Date().toISOString(),
                finalResult,
                },
            })

            return Response.json({
                status: 'completed',
                result: finalResult,
            })
        } else if (nextQuestionId) {
            const nextQuestion = await req.payload.findByID({
                collection: 'question-bank' as unknown as CollectionSlug,
                id: nextQuestionId,
            }) as unknown

            return Response.json({
                status: 'continue',
                type: 'question',
                data: nextQuestion,
            })
        }
    }

    return new Response('Invalid request', { status: 400 })

  } catch (error) {
    console.error('Submit Answer Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}


