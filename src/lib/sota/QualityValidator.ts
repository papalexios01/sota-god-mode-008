// ============================================================
// QUALITY VALIDATOR - Multi-Layer Content Validation
// ============================================================

import type { QualityScore, ContentMetrics } from './types';

// AI trigger phrases to detect and remove
const AI_TRIGGER_PHRASES = [
  'in conclusion',
  'it\'s important to note',
  'it is worth noting',
  'as we can see',
  'in today\'s world',
  'in the ever-evolving',
  'in this comprehensive guide',
  'delve into',
  'delves into',
  'dive deep into',
  'at the end of the day',
  'first and foremost',
  'needless to say',
  'without further ado',
  'in a nutshell',
  'the bottom line is',
  'to summarize',
  'in summary',
  'to sum up',
  'as mentioned earlier',
  'as previously mentioned',
  'it goes without saying',
  'interestingly enough',
  'as a matter of fact',
  'for all intents and purposes',
  'revolutionize',
  'game-changer',
  'cutting-edge',
  'state-of-the-art',
  'leverage',
  'synergy',
  'paradigm shift',
  'holistic approach',
  'robust solution',
  'seamlessly',
  'empower',
  'utilize'
];

function countSyllables(word: string): number {
  word = word.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  let count = 0;
  const vowels = 'aeiouy';
  let prevIsVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !prevIsVowel) count++;
    prevIsVowel = isVowel;
  }

  if (word.endsWith('e') && !word.endsWith('le') && count > 1) count--;
  if (word.endsWith('ed') && !word.endsWith('ted') && !word.endsWith('ded') && count > 1) count--;
  if (word.endsWith('es') && !word.endsWith('ses') && !word.endsWith('zes') && count > 1) count--;

  return Math.max(1, count);
}

function calculateFleschKincaid(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (sentences.length === 0 || words.length === 0) return 0;
  
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;
  
  // Flesch-Kincaid Grade Level
  return 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
}

export function analyzeContent(content: string): ContentMetrics {
  // Strip HTML tags for text analysis
  const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  const words = textContent.split(/\s+/).filter(w => w.length > 0);
  const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = content.split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>/gi).filter(p => p.trim().length > 0);
  
  // Count headings
  const h1Count = (content.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (content.match(/<h2[^>]*>/gi) || []).length;
  const h3Count = (content.match(/<h3[^>]*>/gi) || []).length;
  const headingCount = h1Count + h2Count + h3Count;
  
  // Count images
  const imageCount = (content.match(/<img[^>]*>/gi) || []).length;
  
  // Count links
  const linkCount = (content.match(/<a[^>]*href/gi) || []).length;
  
  // Calculate readability
  const readabilityGrade = calculateFleschKincaid(textContent);
  
  // Estimated read time (average 200 words per minute)
  const estimatedReadTime = Math.ceil(words.length / 200);
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    headingCount,
    imageCount,
    linkCount,
    keywordDensity: 0, // Calculate separately with keyword
    readabilityGrade,
    estimatedReadTime
  };
}

export function calculateKeywordDensity(content: string, keyword: string): number {
  const textContent = content.replace(/<[^>]*>/g, ' ').toLowerCase();
  const words = textContent.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;

  const keywordLower = keyword.toLowerCase().trim();
  const keywordParts = keywordLower.split(/\s+/);

  if (keywordParts.length === 1) {
    const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = textContent.match(regex);
    return ((matches?.length || 0) / words.length) * 100;
  }

  const fullText = words.join(' ');
  const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  const matches = fullText.match(regex);
  return ((matches?.length || 0) / words.length) * 100;
}

export function detectAITriggerPhrases(content: string): string[] {
  const lowerContent = content.toLowerCase();
  return AI_TRIGGER_PHRASES.filter(phrase => lowerContent.includes(phrase));
}

export function calculateQualityScore(
  content: string,
  keyword: string,
  existingLinks: string[] = []
): QualityScore {
  const metrics = analyzeContent(content);
  const aiPhrases = detectAITriggerPhrases(content);
  const keywordDensity = calculateKeywordDensity(content, keyword);
  
  const improvements: string[] = [];
  let totalScore = 0;
  let checks = 0;

  // 1. Word Count Check (2500-3500 ideal)
  checks++;
  if (metrics.wordCount >= 2500 && metrics.wordCount <= 4000) {
    totalScore += 10;
  } else if (metrics.wordCount >= 1500 && metrics.wordCount < 2500) {
    totalScore += 6;
    improvements.push(`Increase word count from ${metrics.wordCount} to 2500+ words`);
  } else if (metrics.wordCount > 4000) {
    totalScore += 8;
    improvements.push('Consider splitting into multiple articles (very long content)');
  } else {
    totalScore += 3;
    improvements.push(`Significantly increase word count from ${metrics.wordCount} to 2500+ words`);
  }

  // 2. Readability Check (Grade 6-9 ideal)
  checks++;
  if (metrics.readabilityGrade >= 6 && metrics.readabilityGrade <= 9) {
    totalScore += 10;
  } else if (metrics.readabilityGrade < 6) {
    totalScore += 7;
    improvements.push('Content may be too simple - add more depth');
  } else if (metrics.readabilityGrade <= 12) {
    totalScore += 6;
    improvements.push('Simplify language - aim for grade 6-9 reading level');
  } else {
    totalScore += 3;
    improvements.push('Content is too complex - significantly simplify language');
  }

  // 3. Heading Structure
  checks++;
  if (metrics.headingCount >= 5 && metrics.headingCount <= 15) {
    totalScore += 10;
  } else if (metrics.headingCount >= 3) {
    totalScore += 6;
    improvements.push('Add more headings for better structure');
  } else {
    totalScore += 2;
    improvements.push('Add multiple H2 and H3 headings for structure');
  }

  // 4. Keyword Density (1-3% ideal)
  checks++;
  if (keywordDensity >= 1 && keywordDensity <= 3) {
    totalScore += 10;
  } else if (keywordDensity >= 0.5 && keywordDensity < 1) {
    totalScore += 6;
    improvements.push('Increase primary keyword usage slightly');
  } else if (keywordDensity > 3 && keywordDensity <= 5) {
    totalScore += 6;
    improvements.push('Reduce keyword density to avoid keyword stuffing');
  } else {
    totalScore += 2;
    improvements.push(`Adjust keyword density (currently ${keywordDensity.toFixed(1)}%)`);
  }

  // 5. AI Phrase Detection
  checks++;
  if (aiPhrases.length === 0) {
    totalScore += 10;
  } else if (aiPhrases.length <= 2) {
    totalScore += 6;
    improvements.push(`Remove AI phrases: ${aiPhrases.slice(0, 2).join(', ')}`);
  } else {
    totalScore += 2;
    improvements.push(`Remove ${aiPhrases.length} AI trigger phrases detected`);
  }

  // 6. Internal Links
  checks++;
  const internalLinks = existingLinks.length;
  if (internalLinks >= 8 && internalLinks <= 15) {
    totalScore += 10;
  } else if (internalLinks >= 5) {
    totalScore += 7;
    improvements.push('Add more internal links (aim for 8-15)');
  } else if (internalLinks >= 2) {
    totalScore += 4;
    improvements.push('Significantly increase internal linking');
  } else {
    totalScore += 1;
    improvements.push('Add internal links to related content');
  }

  // 7. Image Count
  checks++;
  if (metrics.imageCount >= 3 && metrics.imageCount <= 10) {
    totalScore += 10;
  } else if (metrics.imageCount >= 1) {
    totalScore += 5;
    improvements.push('Add more images for visual engagement');
  } else {
    totalScore += 0;
    improvements.push('Add images to improve engagement');
  }

  // 8. Paragraph Structure
  checks++;
  const avgWordsPerParagraph = metrics.wordCount / Math.max(metrics.paragraphCount, 1);
  if (avgWordsPerParagraph >= 50 && avgWordsPerParagraph <= 150) {
    totalScore += 10;
  } else if (avgWordsPerParagraph < 50) {
    totalScore += 6;
    improvements.push('Paragraphs are too short - add more depth');
  } else {
    totalScore += 5;
    improvements.push('Break up long paragraphs for readability');
  }

  // Calculate scores - Enhanced scoring for high-quality content
  const overall = Math.round((totalScore / (checks * 10)) * 100);
  
  // Enhanced readability score - more generous for grade 5-10 range
  const readabilityBase = metrics.readabilityGrade >= 5 && metrics.readabilityGrade <= 10 
    ? 95 
    : Math.max(0, 100 - (Math.abs(metrics.readabilityGrade - 7.5) * 8));
  
  // Enhanced SEO score with better weighting
  const seoBase = Math.min(100, 
    (keywordDensity >= 0.8 && keywordDensity <= 3.5 ? 45 : Math.min(40, keywordDensity * 12)) +
    (metrics.headingCount >= 5 ? 35 : Math.min(30, metrics.headingCount * 6)) +
    (internalLinks >= 5 ? 25 : Math.min(25, internalLinks * 5))
  );
  
  // Enhanced E-E-A-T score - looks for citations, expert mentions, first-person experience
  const contentLower = content.toLowerCase();
  const hasCitations = /according to|study|research|report|\d{4}/.test(contentLower);
  const hasExpertQuotes = /dr\.|professor|expert|specialist|says|states/.test(contentLower);
  const hasFirstPerson = /\bi\b|\bmy\b|\bwe\b|\bour\b/.test(contentLower);
  const eeatBonus = (hasCitations ? 10 : 0) + (hasExpertQuotes ? 10 : 0) + (hasFirstPerson ? 10 : 0);
  const eeatBase = Math.min(100, 65 + eeatBonus + (aiPhrases.length === 0 ? 15 : -aiPhrases.length * 3));
  
  // Enhanced uniqueness - less penalty for minor AI phrase occurrences
  const uniquenessBase = Math.max(70, 100 - (aiPhrases.length * 3));
  
  // Enhanced fact accuracy - check for specific indicators
  const hasStats = /\d+%|\d+\s*(million|billion|thousand)/.test(content);
  const hasYears = /20\d{2}|19\d{2}/.test(content);
  const factAccuracyBase = 80 + (hasStats ? 10 : 0) + (hasYears ? 10 : 0);
  
  return {
    overall: Math.min(100, Math.max(0, overall)),
    readability: Math.min(100, Math.max(0, readabilityBase)),
    seo: Math.min(100, Math.max(0, seoBase)),
    eeat: Math.min(100, Math.max(0, eeatBase)),
    uniqueness: Math.min(100, Math.max(0, uniquenessBase)),
    factAccuracy: Math.min(100, Math.max(0, factAccuracyBase)),
    passed: overall >= 75,
    improvements
  };
}

export function removeAIPhrases(content: string): string {
  let cleaned = content;

  AI_TRIGGER_PHRASES.forEach(phrase => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  cleaned = cleaned.replace(/ {2,}/g, ' ');
  cleaned = cleaned.replace(/>\s{2,}/g, '> ');
  cleaned = cleaned.replace(/\s{2,}</g, ' <');

  return cleaned;
}
