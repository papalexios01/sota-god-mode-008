// ============================================================
// SOTA INTERNAL LINK ENGINE v2.0 - REAL URLs from Crawled Sitemap
// Uses actual sitemap URLs with intelligent contextual anchor text
// ============================================================

import type { InternalLink } from './types';

export interface SitePage {
  url: string;
  title: string;
  keywords?: string[];
  category?: string;
}

export class SOTAInternalLinkEngine {
  private sitePages: SitePage[];
  private stopWords: Set<string>;

  constructor(sitePages: SitePage[] = []) {
    this.sitePages = sitePages;
    this.stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
      'which', 'who', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then'
    ]);
  }

  updateSitePages(pages: SitePage[]): void {
    this.sitePages = pages;
    console.log(`[InternalLinkEngine] Updated with ${pages.length} site pages`);
  }

  /**
   * Generate internal link opportunities using REAL URLs from sitemap
   * Only returns links to actual pages that exist on the site
   */
  generateLinkOpportunities(
    content: string,
    maxLinks: number = 12
  ): InternalLink[] {
    if (this.sitePages.length === 0) {
      console.log('[InternalLinkEngine] No site pages available - skipping internal links');
      return [];
    }

    console.log(`[InternalLinkEngine] Finding links from ${this.sitePages.length} available pages`);
    
    const opportunities: InternalLink[] = [];
    const usedUrls = new Set<string>();
    const usedAnchors = new Set<string>();
    const contentLower = content.toLowerCase();

    // Strategy 1: Find pages whose title/slug appears in content (highest relevance)
    for (const page of this.sitePages) {
      if (opportunities.length >= maxLinks) break;
      if (usedUrls.has(page.url)) continue;

      const matchResult = this.findBestAnchorInContent(content, contentLower, page);
      if (matchResult && !usedAnchors.has(matchResult.anchor.toLowerCase())) {
        opportunities.push({
          anchor: matchResult.anchor,
          targetUrl: page.url,
          context: matchResult.context,
          priority: matchResult.priority,
          relevanceScore: matchResult.relevance
        });
        usedUrls.add(page.url);
        usedAnchors.add(matchResult.anchor.toLowerCase());
      }
    }

    // Strategy 2: For remaining slots, find contextually relevant pages
    if (opportunities.length < maxLinks) {
      const contentKeywords = this.extractKeywords(content);
      
      for (const page of this.sitePages) {
        if (opportunities.length >= maxLinks) break;
        if (usedUrls.has(page.url)) continue;

        const keywordMatch = this.findKeywordMatch(contentKeywords, page);
        if (keywordMatch && !usedAnchors.has(keywordMatch.anchor.toLowerCase())) {
          const context = this.findLinkContext(content, keywordMatch.anchor);
          if (context) {
            opportunities.push({
              anchor: keywordMatch.anchor,
              targetUrl: page.url,
              context,
              priority: keywordMatch.priority,
              relevanceScore: keywordMatch.relevance
            });
            usedUrls.add(page.url);
            usedAnchors.add(keywordMatch.anchor.toLowerCase());
          }
        }
      }
    }

    console.log(`[InternalLinkEngine] Generated ${opportunities.length} internal link opportunities`);
    
    return opportunities
      .sort((a, b) => (b.priority + b.relevanceScore) - (a.priority + a.relevanceScore))
      .slice(0, maxLinks);
  }

  /**
   * Find the best anchor text for a page within the content
   */
  private findBestAnchorInContent(
    content: string, 
    contentLower: string, 
    page: SitePage
  ): { anchor: string; context: string; priority: number; relevance: number } | null {
    // Extract potential anchors from the page
    const titleWords = this.extractMeaningfulWords(page.title);
    const slugWords = this.extractSlugWords(page.url);
    
    // Try to find multi-word phrases from title
    const titlePhrases = this.generatePhrases(titleWords, 2, 4);
    
    for (const phrase of titlePhrases) {
      const phraseLower = phrase.toLowerCase();
      const index = contentLower.indexOf(phraseLower);
      if (index !== -1) {
        // Get the actual case from content
        const actualPhrase = content.substring(index, index + phrase.length);
        const context = this.getContextAroundIndex(content, index, phrase.length);
        
        // Higher priority for longer, more specific matches
        const priority = 80 + (phrase.split(' ').length * 5);
        const relevance = 90;
        
        return { anchor: actualPhrase, context, priority, relevance };
      }
    }
    
    // Try single meaningful words from title
    for (const word of titleWords) {
      if (word.length < 4) continue;
      const wordLower = word.toLowerCase();
      const regex = new RegExp(`\\b${this.escapeRegex(wordLower)}\\b`, 'i');
      const match = content.match(regex);
      if (match && match.index !== undefined) {
        const actualWord = content.substring(match.index, match.index + word.length);
        const context = this.getContextAroundIndex(content, match.index, word.length);
        return { anchor: actualWord, context, priority: 50, relevance: 60 };
      }
    }
    
    return null;
  }

  /**
   * Find keyword-based matches
   */
  private findKeywordMatch(
    contentKeywords: string[],
    page: SitePage
  ): { anchor: string; priority: number; relevance: number } | null {
    const pageTitleLower = page.title.toLowerCase();
    const pageKeywords = page.keywords?.map(k => k.toLowerCase()) || [];
    
    for (const keyword of contentKeywords) {
      const keywordLower = keyword.toLowerCase();
      
      // Check if keyword matches page title or keywords
      if (pageTitleLower.includes(keywordLower) || pageKeywords.some(pk => pk.includes(keywordLower))) {
        return {
          anchor: keyword,
          priority: 40,
          relevance: 50
        };
      }
    }
    
    return null;
  }

  private extractMeaningfulWords(text: string): string[] {
    return text
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(w => w.length > 2 && !this.stopWords.has(w.toLowerCase()));
  }

  private extractSlugWords(url: string): string[] {
    try {
      const slug = new URL(url).pathname.split('/').pop() || '';
      return slug.split('-').filter(w => w.length > 2 && !this.stopWords.has(w.toLowerCase()));
    } catch {
      return [];
    }
  }

  private generatePhrases(words: string[], minLen: number, maxLen: number): string[] {
    const phrases: string[] = [];
    
    for (let len = maxLen; len >= minLen; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        phrases.push(words.slice(i, i + len).join(' '));
      }
    }
    
    return phrases;
  }

  private getContextAroundIndex(content: string, index: number, matchLength: number): string {
    const text = content.replace(/<[^>]*>/g, ' ');
    const start = Math.max(0, index - 80);
    const end = Math.min(text.length, index + matchLength + 80);
    return text.slice(start, end).trim();
  }

  private extractKeywords(content: string): string[] {
    // Strip HTML
    const text = content.replace(/<[^>]*>/g, ' ');
    
    // Extract potential anchor phrases (2-4 word phrases)
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const keywords: string[] = [];

    // Single important words
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length > 3 && !this.stopWords.has(clean)) {
        wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
      }
    });

    // Get top single keywords
    Array.from(wordFreq.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([word]) => keywords.push(word));

    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      if (this.isValidPhrase(phrase)) {
        keywords.push(phrase);
      }
    }

    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      if (this.isValidPhrase(phrase)) {
        keywords.push(phrase);
      }
    }

    return [...new Set(keywords)];
  }

  private isValidPhrase(phrase: string): boolean {
    const words = phrase.split(' ');
    // At least one word should not be a stop word
    const hasContentWord = words.some(w => !this.stopWords.has(w) && w.length > 2);
    return hasContentWord && phrase.length > 5 && phrase.length < 50;
  }

  private findBestMatchingPage(keyword: string, usedUrls: Set<string>): SitePage | null {
    const keywordLower = keyword.toLowerCase();
    
    let bestMatch: SitePage | null = null;
    let bestScore = 0;

    for (const page of this.sitePages) {
      if (usedUrls.has(page.url)) continue;

      let score = 0;
      const titleLower = page.title.toLowerCase();
      const urlLower = page.url.toLowerCase();

      // Exact title match
      if (titleLower === keywordLower) {
        score += 100;
      }
      // Title contains keyword
      else if (titleLower.includes(keywordLower)) {
        score += 50;
      }
      // Keyword contains title
      else if (keywordLower.includes(titleLower)) {
        score += 30;
      }

      // URL slug match
      const slug = urlLower.split('/').pop() || '';
      if (slug.includes(keywordLower.replace(/\s+/g, '-'))) {
        score += 40;
      }

      // Keyword match
      if (page.keywords) {
        for (const pageKeyword of page.keywords) {
          if (pageKeyword.toLowerCase() === keywordLower) {
            score += 60;
          } else if (pageKeyword.toLowerCase().includes(keywordLower)) {
            score += 20;
          }
        }
      }

      // Word overlap
      const keywordWords = keywordLower.split(' ');
      const titleWords = titleLower.split(' ');
      const overlap = keywordWords.filter(w => titleWords.includes(w)).length;
      score += overlap * 10;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = page;
      }
    }

    return bestScore >= 20 ? bestMatch : null;
  }

  private findLinkContext(content: string, keyword: string): string {
    const text = content.replace(/<[^>]*>/g, ' ');
    const keywordLower = keyword.toLowerCase();
    const textLower = text.toLowerCase();
    
    const index = textLower.indexOf(keywordLower);
    if (index === -1) return '';

    // Get surrounding context (100 chars before and after)
    const start = Math.max(0, index - 100);
    const end = Math.min(text.length, index + keyword.length + 100);
    
    return text.slice(start, end).trim();
  }

  private calculateLinkPriority(keyword: string, page: SitePage): number {
    let priority = 50; // Base priority

    // Longer, more specific keywords get higher priority
    priority += Math.min(keyword.split(' ').length * 10, 30);

    // Pages with keywords defined are more relevant
    if (page.keywords && page.keywords.length > 0) {
      priority += 10;
    }

    // Category pages might be more important
    if (page.category) {
      priority += 5;
    }

    return Math.min(priority, 100);
  }

  private calculateRelevanceScore(keyword: string, page: SitePage): number {
    const keywordLower = keyword.toLowerCase();
    const titleLower = page.title.toLowerCase();
    
    // Calculate Jaccard similarity
    const keywordWords = new Set(keywordLower.split(' '));
    const titleWords = new Set(titleLower.split(' '));
    
    const intersection = new Set([...keywordWords].filter(w => titleWords.has(w)));
    const union = new Set([...keywordWords, ...titleWords]);
    
    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Inject contextual links into content - ONLY uses real URLs from sitemap
   */
  injectContextualLinks(content: string, links: InternalLink[]): string {
    if (links.length === 0) {
      console.log('[InternalLinkEngine] No links to inject');
      return content;
    }

    let modifiedContent = content;
    const injectedAnchors = new Set<string>();
    let injectedCount = 0;

    // Sort links by anchor length (longer first to avoid partial replacements)
    const sortedLinks = [...links].sort((a, b) => (b.anchor?.length || 0) - (a.anchor?.length || 0));

    for (const link of sortedLinks) {
      const anchor = link.anchor || link.anchorText || link.text;
      if (!anchor || injectedAnchors.has(anchor.toLowerCase())) continue;
      if (!link.targetUrl) continue;

      // Find the first occurrence that's not already linked
      // Use negative lookbehind/lookahead to avoid re-linking
      try {
        const escapedAnchor = this.escapeRegex(anchor);
        const regex = new RegExp(
          `(?<!<a[^>]*>)(?<![\\w-])\\b(${escapedAnchor})\\b(?![^<]*<\\/a>)`,
          'i'
        );

        const match = modifiedContent.match(regex);
        if (match && match[1] && match.index !== undefined) {
          const actualText = modifiedContent.substring(match.index, match.index + match[1].length);
          const linkHtml = `<a href="${link.targetUrl}" title="${anchor}">${actualText}</a>`;
          modifiedContent = modifiedContent.slice(0, match.index) + linkHtml + modifiedContent.slice(match.index + match[1].length);
          injectedAnchors.add(anchor.toLowerCase());
          injectedCount++;
          console.log(`[InternalLinkEngine] Injected: "${anchor}" → ${link.targetUrl}`);
        }
      } catch (e) {
        console.warn(`[InternalLinkEngine] Regex failed for anchor "${anchor}":`, e);
      }
    }

    console.log(`[InternalLinkEngine] Successfully injected ${injectedCount} links`);
    return modifiedContent;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  identifyTopicClusters(): Map<string, SitePage[]> {
    const clusters = new Map<string, SitePage[]>();

    // Group by category if available
    this.sitePages.forEach(page => {
      const category = page.category || 'uncategorized';
      if (!clusters.has(category)) {
        clusters.set(category, []);
      }
      clusters.get(category)!.push(page);
    });

    // Also cluster by common keywords
    const keywordClusters = new Map<string, SitePage[]>();
    this.sitePages.forEach(page => {
      if (page.keywords) {
        page.keywords.forEach(keyword => {
          if (!keywordClusters.has(keyword)) {
            keywordClusters.set(keyword, []);
          }
          keywordClusters.get(keyword)!.push(page);
        });
      }
    });

    // Merge keyword clusters that have 3+ pages
    keywordClusters.forEach((pages, keyword) => {
      if (pages.length >= 3 && !clusters.has(keyword)) {
        clusters.set(`topic:${keyword}`, pages);
      }
    });

    return clusters;
  }

  getSuggestedLinksForPage(currentUrl: string): SitePage[] {
    const currentPage = this.sitePages.find(p => p.url === currentUrl);
    if (!currentPage) return [];

    return this.sitePages
      .filter(p => p.url !== currentUrl)
      .map(page => ({
        page,
        score: this.calculatePageSimilarity(currentPage, page)
      }))
      .filter(item => item.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.page);
  }

  private calculatePageSimilarity(page1: SitePage, page2: SitePage): number {
    let score = 0;

    // Same category
    if (page1.category && page1.category === page2.category) {
      score += 40;
    }

    // Keyword overlap
    if (page1.keywords && page2.keywords) {
      const overlap = page1.keywords.filter(k => page2.keywords!.includes(k)).length;
      score += overlap * 15;
    }

    // Title word overlap
    const title1Words = new Set(page1.title.toLowerCase().split(' '));
    const title2Words = new Set(page2.title.toLowerCase().split(' '));
    const titleOverlap = [...title1Words].filter(w => title2Words.has(w) && !this.stopWords.has(w)).length;
    score += titleOverlap * 10;

    return score;
  }
}

export function createInternalLinkEngine(sitePages: SitePage[] = []): SOTAInternalLinkEngine {
  return new SOTAInternalLinkEngine(sitePages);
}
