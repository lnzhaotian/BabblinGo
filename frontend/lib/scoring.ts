import levenshtein from 'fast-levenshtein'

/**
 * Normalizes text by removing punctuation and converting to lowercase.
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Calculates a pronunciation score between 0 and 100 based on the similarity
 * between the expected transcript and the user's spoken text.
 */
export const calculatePronunciationScore = (expected: string, spoken: string): number => {
  if (!expected || !spoken) return 0

  const normalizedExpected = normalizeText(expected)
  const normalizedSpoken = normalizeText(spoken)

  if (normalizedExpected.length === 0) return 0
  if (normalizedSpoken.length === 0) return 0

  const distance = levenshtein.get(normalizedExpected, normalizedSpoken)
  const maxLength = Math.max(normalizedExpected.length, normalizedSpoken.length)

  const similarity = 1 - distance / maxLength
  return Math.max(0, Math.min(100, Math.round(similarity * 100)))
}
