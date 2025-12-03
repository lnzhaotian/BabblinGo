import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { QuestionnaireDoc, QuestionnaireQuestion } from '@/lib/testing-types'
import { useThemeMode } from '@/app/theme-context'
import { useTranslation } from 'react-i18next'

interface Props {
  questionnaire: QuestionnaireDoc
  onSubmit: (answers: Record<string, any>) => void
  submitting?: boolean
}

export function QuestionnaireRenderer({ questionnaire, onSubmit, submitting }: Props) {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'
  const [answers, setAnswers] = useState<Record<string, any>>({})

  const handleAnswer = (questionIndex: number, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }))
  }

  const handleSubmit = () => {
    // Validate?
    onSubmit(answers)
  }

  const renderQuestion = (question: QuestionnaireQuestion, index: number) => {
    return (
      <View key={question.id || index} style={styles.questionContainer}>
        <Text style={[styles.prompt, { color: isDark ? '#fff' : '#000' }]}>
          {index + 1}. {question.prompt}
        </Text>
        
        {question.type === 'text' && (
          <TextInput
            style={[
              styles.input,
              { 
                color: isDark ? '#fff' : '#000',
                borderColor: isDark ? '#4b5563' : '#d1d5db',
                backgroundColor: isDark ? '#1f2937' : '#fff'
              }
            ]}
            value={answers[index] || ''}
            onChangeText={(text) => handleAnswer(index, text)}
            placeholder={t('tests.question.typePlaceholder')}
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
          />
        )}

        {question.type === 'choice' && (
          <View style={styles.optionsContainer}>
            {question.options?.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionButton,
                  answers[index] === opt.value && styles.selectedOption,
                  { borderColor: isDark ? '#4b5563' : '#d1d5db' }
                ]}
                onPress={() => handleAnswer(index, opt.value)}
              >
                <Text style={[
                  styles.optionText,
                  { color: isDark ? '#fff' : '#000' },
                  answers[index] === opt.value && styles.selectedOptionText
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {question.type === 'multiple_choice' && (
          <View style={styles.optionsContainer}>
            {question.options?.map((opt) => {
              const currentAnswers = (answers[index] as string[]) || []
              const isSelected = currentAnswers.includes(opt.value)
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    isSelected && styles.selectedOption,
                    { borderColor: isDark ? '#4b5563' : '#d1d5db' }
                  ]}
                  onPress={() => {
                    const newAnswers = isSelected
                      ? currentAnswers.filter(a => a !== opt.value)
                      : [...currentAnswers, opt.value]
                    handleAnswer(index, newAnswers)
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { color: isDark ? '#fff' : '#000' },
                    isSelected && styles.selectedOptionText
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {question.type === 'scale' && (
          <View style={styles.scaleContainer}>
            {[1, 2, 3, 4, 5].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.scaleButton,
                  answers[index] === val && styles.selectedScale,
                  { borderColor: isDark ? '#4b5563' : '#d1d5db' }
                ]}
                onPress={() => handleAnswer(index, val)}
              >
                <Text style={[
                  styles.scaleText,
                  { color: isDark ? '#fff' : '#000' },
                  answers[index] === val && styles.selectedScaleText
                ]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.scaleLabels}>
              <Text style={[styles.scaleLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Low</Text>
              <Text style={[styles.scaleLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>High</Text>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
        {questionnaire.title}
      </Text>
      {questionnaire.description && (
        <Text style={[styles.description, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
          {questionnaire.description}
        </Text>
      )}

      {questionnaire.questions.map((q, i) => renderQuestion(q, i))}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? t('tests.question.processingStatus') : t('tests.questionnaire.submit')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
  },
  questionContainer: {
    marginBottom: 24,
  },
  prompt: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  selectedOption: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  optionText: {
    fontSize: 16,
  },
  selectedOptionText: {
    color: '#fff',
  },
  scaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedScale: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  scaleText: {
    fontSize: 18,
    fontWeight: '600',
  },
  selectedScaleText: {
    color: '#fff',
  },
  scaleLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
