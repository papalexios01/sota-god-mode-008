// ============================================================
// SOTA INTERNAL LINK ENGINE - Intelligent Internal Linking
// ============================================================

import type { InternalLink } from './types';

interface SitePage {
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
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when',
      'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then'
    ]);
  }

  updateSitePages(pages: SitePage[]): void {
    this.sitePages = pages;
  }

  generateLinkOpportunities(
    content: string,
    maxLinks: number = 15
  ): InternalLink[] {
    if (this.sitePages.length === 0) {
      return [];
    }

    const opportunities: InternalLink[] = [];
    const usedUrls = new Set<string>();
    const usedAnchors = new Set<string>();

    // Extract keywords from content
    const contentKeywords = this.extractKeywords(content);

    // Find matching pages for each keyword
    for (const keyword of contentKeywords) {
      if (opportunities.length >= maxLinks) break;

      const matchingPage = this.findBestMatchingPage(keyword, usedUrls);
      if (matchingPage) {
        // Find the best context for this link
        const context = this.findLinkContext(content, keyword);
        if (context && !usedAnchors.has(keyword.toLowerCase())) {
          opportunities.push({
            anchor: keyword,
            targetUrl: matchingPage.url,
            context,
            priority: this.calculateLinkPriority(keyword, matchingPage),
            relevanceScore: this.calculateRelevanceScore(keyword, matchingPage)
          });
          usedUrls.add(matchingPage.url);
          usedAnchors.add(keyword.toLowerCase());
        }
      }
    }

    // Sort by priority and relevance
    return opportunities
      .sort((a, b) => (b.priority + b.relevanceScore) - (a.priority + a.relevanceScore))
      .slice(0, maxLinks);
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

  injectContextualLinks(content: string, links: InternalLink[]): string {
    let modifiedContent = content;
    const injectedAnchors = new Set<string>();

    // Sort links by anchor length (longer first to avoid partial replacements)
    const sortedLinks = [...links].sort((a, b) => b.anchor.length - a.anchor.length);

    for (const link of sortedLinks) {
      if (injectedAnchors.has(link.anchor.toLowerCase())) continue;

      // Find the first occurrence that's not already linked
      const regex = new RegExp(
        `(?<!<a[^>]*>)\\b(${this.escapeRegex(link.anchor)})\\b(?![^<]*<\/a>)`,
        'i'
      );

      const match = modifiedContent.match(regex);
      if (match && match[1]) {
        const replacement = `<a href="${link.targetUrl}" title="${link.anchor}">${match[1]}</a>`;
        modifiedContent = modifiedContent.replace(regex, replacement);
        injectedAnchors.add(link.anchor.toLowerCase());
      }
    }

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
