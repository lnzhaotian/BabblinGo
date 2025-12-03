import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/app/theme-context'
import { TestSessionDoc } from '@/lib/testing-types'
import { LexicalContent } from '@/components/LexicalContent'
import { Ionicons } from '@expo/vector-icons'
import { fetchLevelDescriptions } from '@/lib/testing-api'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const ACTFL_ORDER = ['novice_low', 'novice_mid', 'novice_high', 'intermediate_low', 'intermediate_mid', 'intermediate_high', 'advanced_low', 'advanced_mid', 'advanced_high', 'superior', 'distinguished']

type Props = {
  result: TestSessionDoc['finalResult']
  showTitle?: boolean
}

export const TestResultView: React.FC<Props> = ({ result, showTitle = true }) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'
  const [allLevels, setAllLevels] = useState<any[]>([])
  const [showLevels, setShowLevels] = useState(false)

  useEffect(() => {
    fetchLevelDescriptions().then(levels => setAllLevels(levels)).catch(console.error)
  }, [])

  if (!result) return null

  // Filter and sort levels
  const standard = result.level && (CEFR_ORDER.includes(result.level) ? 'cefr' : ACTFL_ORDER.includes(result.level) ? 'actfl' : null)
  const sortedLevels = allLevels
      .filter(l => !standard || l.standard === standard)
      .sort((a, b) => {
          const order = standard === 'cefr' ? CEFR_ORDER : ACTFL_ORDER
          const valA = standard === 'cefr' ? a.level_cefr : a.level_actfl
          const valB = standard === 'cefr' ? b.level_cefr : b.level_actfl
          return order.indexOf(valA) - order.indexOf(valB)
      })

  return (
    <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <Ionicons 
        name={result.passed ? "trophy" : "school"} 
        size={80} 
        color={result.passed ? "#eab308" : "#3b82f6"} 
        />
        {showTitle && (
            <Text style={[styles.resultTitle, { color: isDark ? '#f1f5f9' : '#18181b' }]}>
            {t('tests.result.title')}
            </Text>
        )}
        
        {result.levelDescription ? (
            <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={[styles.resultTitle, { color: isDark ? '#f1f5f9' : '#18181b', marginBottom: 16, marginTop: 0, fontSize: 28 }]}>
                {result.levelTitle || result.level}
                </Text>
                <View style={{ width: '100%', backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24 }}>
                    <LexicalContent content={result.levelDescription} colorScheme={colorScheme} />
                </View>

                {/* Expandable Levels List */}
                {sortedLevels.length > 0 && (
                    <View style={{ width: '100%', marginBottom: 24 }}>
                        <TouchableOpacity 
                            onPress={() => setShowLevels(!showLevels)}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 }}
                        >
                            <Text style={{ color: isDark ? '#60a5fa' : '#2563eb', fontSize: 16, fontWeight: '600', marginRight: 8 }}>
                                {showLevels ? t('tests.result.hideLevels') : t('tests.result.showLevels')} {standard ? `(${standard.toUpperCase()})` : ''}
                            </Text>
                            <Ionicons name={showLevels ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
                        </TouchableOpacity>
                        
                        {showLevels && (
                            <View style={{ marginTop: 12, gap: 8 }}>
                                {sortedLevels.map((lvl, idx) => {
                                    const lvlValue = standard === 'cefr' ? lvl.level_cefr : lvl.level_actfl
                                    const isCurrent = lvlValue === result.level
                                    return (
                                        <View key={idx} style={{ 
                                            padding: 12, 
                                            borderRadius: 8, 
                                            backgroundColor: isCurrent ? (isDark ? '#1e3a8a' : '#eff6ff') : (isDark ? '#27272a' : '#f1f5f9'),
                                            borderWidth: isCurrent ? 2 : 0,
                                            borderColor: isDark ? '#60a5fa' : '#2563eb'
                                        }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <Text style={{ color: isDark ? '#f1f5f9' : '#18181b', fontWeight: '700', fontSize: 16 }}>
                                                    {lvl.title}
                                                </Text>
                                                {isCurrent && (
                                                    <View style={{ backgroundColor: isDark ? '#60a5fa' : '#2563eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                                                            {t('tests.result.yourLevel')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <LexicalContent content={lvl.description} colorScheme={colorScheme} />
                                        </View>
                                    )
                                })}
                            </View>
                        )}
                    </View>
                )}
            </View>
        ) : (
            <View style={[styles.scoreCard, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            <Text style={[styles.scoreLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {t('tests.result.score')}
            </Text>
            <Text style={[styles.scoreValue, { color: isDark ? '#f1f5f9' : '#18181b' }]}>
                {result.score} / {result.maxScore}
            </Text>
            <Text style={[styles.passStatus, { color: result.passed ? '#22c55e' : '#ef4444' }]}>
                {result.passed ? t('tests.result.passed') : t('tests.result.failed')}
            </Text>
            </View>
        )}

        {/* Skill Breakdown */}
        {result.skillBreakdown && Object.keys(result.skillBreakdown).length > 0 && (
            <View style={{ width: '100%', marginTop: 24 }}>
                <Text style={[styles.resultTitle, { fontSize: 20, marginBottom: 16, color: isDark ? '#f1f5f9' : '#18181b', marginTop: 0 }]}>
                    {t('tests.result.skills')}
                </Text>
                {Object.entries(result.skillBreakdown).map(([skill, stats]: [string, any]) => (
                    <View key={skill} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontWeight: '600' }}>{skill}</Text>
                            <Text style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{Math.round((stats.correct / stats.total) * 100)}%</Text>
                        </View>
                        <View style={{ height: 8, backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <View style={{ 
                                height: '100%', 
                                width: `${(stats.correct / stats.total) * 100}%`, 
                                backgroundColor: isDark ? '#60a5fa' : '#3b82f6' 
                            }} />
                        </View>
                    </View>
                ))}
            </View>
        )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 32,
  },
  scoreCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  scoreLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 8,
  },
  passStatus: {
    fontSize: 18,
    fontWeight: '600',
  },
})
