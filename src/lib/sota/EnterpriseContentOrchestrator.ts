// ============================================================
// ENTERPRISE CONTENT ORCHESTRATOR - Full Workflow Management
// ============================================================

import type { 
  APIKeys, 
  AIModel, 
  GeneratedContent, 
  ContentMetrics,
  QualityScore,
  SERPAnalysis,
  InternalLink,
  SchemaMarkup,
  EEATProfile,
  YouTubeVideo,
  Reference,
  ContentPlan
} from './types';

import { SOTAContentGenerationEngine, createSOTAEngine, type ExtendedAPIKeys } from './SOTAContentGenerationEngine';
import { SERPAnalyzer, createSERPAnalyzer } from './SERPAnalyzer';
import { YouTubeService, createYouTubeService } from './YouTubeService';
import { ReferenceService, createReferenceService } from './ReferenceService';
import { SOTAInternalLinkEngine, createInternalLinkEngine } from './SOTAInternalLinkEngine';
import { SchemaGenerator, createSchemaGenerator } from './SchemaGenerator';
import { calculateQualityScore, analyzeContent, removeAIPhrases } from './QualityValidator';
import { EEATValidator, createEEATValidator } from './EEATValidator';
import { generationCache } from './cache';

interface OrchestratorConfig {
  apiKeys: ExtendedAPIKeys;
  organizationName: string;
  organizationUrl: string;
  logoUrl?: string;
  authorName: string;
  authorCredentials?: string[];
  sitePages?: { url: string; title: string; keywords?: string[] }[];
  targetCountry?: string;
  useConsensus?: boolean;
  primaryModel?: AIModel;
  // NeuronWriter integration
  neuronWriterApiKey?: string;
  neuronWriterProjectId?: string;
}

interface GenerationOptions {
  keyword: string;
  title?: string;
  contentType?: 'guide' | 'how-to' | 'comparison' | 'listicle' | 'deep-dive';
  targetWordCount?: number;
  includeVideos?: boolean;
  includeReferences?: boolean;
  injectLinks?: boolean;
  generateSchema?: boolean;
  validateEEAT?: boolean;
  neuronWriterQueryId?: string; // Pre-analyzed NeuronWriter query
  onProgress?: (message: string) => void;
}

export class EnterpriseContentOrchestrator {
  private engine: SOTAContentGenerationEngine;
  private serpAnalyzer: SERPAnalyzer;
  private youtubeService: YouTubeService;
  private referenceService: ReferenceService;
  private linkEngine: SOTAInternalLinkEngine;
  private schemaGenerator: SchemaGenerator;
  private eeatValidator: EEATValidator;
  private config: OrchestratorConfig;
  
  private onProgress?: (message: string) => void;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    
    this.engine = createSOTAEngine(config.apiKeys, (msg) => this.log(msg));
    this.serpAnalyzer = createSERPAnalyzer(config.apiKeys.serperApiKey || '');
    this.youtubeService = createYouTubeService(config.apiKeys.serperApiKey || '');
    this.referenceService = createReferenceService(config.apiKeys.serperApiKey || '');
    this.linkEngine = createInternalLinkEngine(config.sitePages);
    this.eeatValidator = createEEATValidator();
    this.schemaGenerator = createSchemaGenerator(
      config.organizationName,
      config.organizationUrl,
      config.logoUrl
    );
  }

  private log(message: string): void {
    this.onProgress?.(message);
    console.log(`[Orchestrator] ${message}`);
  }

  async generateContent(options: GenerationOptions): Promise<GeneratedContent> {
    this.onProgress = options.onProgress;
    const startTime = Date.now();

    this.log(`Starting content generation for: ${options.keyword}`);

    // Phase 1: Parallel Research
    this.log('Phase 1: Research & Analysis...');
    const [serpAnalysis, videos, references] = await Promise.all([
      this.serpAnalyzer.analyze(options.keyword, this.config.targetCountry),
      options.includeVideos !== false 
        ? this.youtubeService.getRelevantVideos(options.keyword, options.contentType)
        : Promise.resolve([]),
      options.includeReferences !== false
        ? this.referenceService.getTopReferences(options.keyword)
        : Promise.resolve([])
    ]);

    this.log(`Found ${videos.length} videos, ${references.length} references`);
    this.log(`SERP Analysis: ${serpAnalysis.userIntent} intent, ${serpAnalysis.recommendedWordCount} words recommended`);

    // Phase 2: Content Generation
    this.log('Phase 2: AI Content Generation...');
    const title = options.title || await this.generateTitle(options.keyword, serpAnalysis);
    const content = await this.generateMainContent(
      options.keyword,
      title,
      serpAnalysis,
      videos,
      references,
      options
    );

    // Phase 3: Enhancement
    this.log('Phase 3: Content Enhancement...');
    let enhancedContent = content;

    // Remove AI phrases
    enhancedContent = removeAIPhrases(enhancedContent);

    // Inject internal links from crawled sitemap
    if (options.injectLinks !== false && this.config.sitePages && this.config.sitePages.length > 0) {
      this.log(`Finding internal links from ${this.config.sitePages.length} crawled pages...`);
      
      // Update the link engine with current site pages
      this.linkEngine.updateSitePages(this.config.sitePages);
      
      // Generate link opportunities (target 8-12 high-quality contextual links)
      const linkOpportunities = this.linkEngine.generateLinkOpportunities(enhancedContent, 12);
      
      if (linkOpportunities.length > 0) {
        enhancedContent = this.linkEngine.injectContextualLinks(enhancedContent, linkOpportunities);
        this.log(`✅ Injected ${linkOpportunities.length} internal links to REAL site pages:`);
        linkOpportunities.slice(0, 5).forEach(link => {
          this.log(`   → "${link.anchor}" → ${link.targetUrl}`);
        });
      } else {
        this.log('⚠️ No matching anchor text found in content for available pages');
      }
    } else {
      this.log('⚠️ No site pages available for internal linking - crawl sitemap first');
    }

    // Phase 4: Validation (parallel quality + E-E-A-T)
    this.log('Phase 4: Quality & E-E-A-T Validation...');
    const metrics = analyzeContent(enhancedContent);
    const internalLinks = this.linkEngine.generateLinkOpportunities(enhancedContent);
    
    // Run quality and E-E-A-T validation in parallel
    const [qualityScore, eeatScore] = await Promise.all([
      Promise.resolve(calculateQualityScore(enhancedContent, options.keyword, internalLinks.map(l => l.targetUrl))),
      Promise.resolve(this.eeatValidator.validateContent(enhancedContent, {
        name: this.config.authorName,
        credentials: this.config.authorCredentials
      }))
    ]);

    this.log(`Quality Score: ${qualityScore.overall}%`);
    this.log(`E-E-A-T Score: ${eeatScore.overall}% (E:${eeatScore.experience} X:${eeatScore.expertise} A:${eeatScore.authoritativeness} T:${eeatScore.trustworthiness})`);
    
    // If E-E-A-T score is low and validation is enabled, log recommendations
    if (options.validateEEAT !== false && eeatScore.overall < 70) {
      const enhancements = this.eeatValidator.generateEEATEnhancements(eeatScore);
      this.log(`E-E-A-T improvements needed: ${enhancements.slice(0, 3).join(', ')}`);
    }

    // Phase 5: Schema & Metadata
    const eeat = this.buildEEATProfile(references);
    const metaDescription = await this.generateMetaDescription(options.keyword, title);
    const slug = this.generateSlug(title);

    const generatedContent: GeneratedContent = {
      id: crypto.randomUUID(),
      title,
      content: enhancedContent,
      metaDescription,
      slug,
      primaryKeyword: options.keyword,
      secondaryKeywords: serpAnalysis.semanticEntities.slice(0, 10),
      metrics,
      qualityScore,
      internalLinks,
      schema: this.schemaGenerator.generateComprehensiveSchema(
        { 
          title, 
          content: enhancedContent, 
          metaDescription, 
          slug, 
          primaryKeyword: options.keyword, 
          secondaryKeywords: [],
          metrics,
          qualityScore,
          internalLinks,
          eeat,
          generatedAt: new Date(),
          model: this.config.primaryModel || 'gemini',
          consensusUsed: this.config.useConsensus || false
        } as GeneratedContent,
        `${this.config.organizationUrl}/${slug}`
      ),
      eeat,
      serpAnalysis,
      generatedAt: new Date(),
      model: this.config.primaryModel || 'gemini',
      consensusUsed: this.config.useConsensus || false
    };

    const duration = Date.now() - startTime;
    this.log(`Generation complete in ${(duration / 1000).toFixed(1)}s`);

    return generatedContent;
  }

  private async generateTitle(keyword: string, serpAnalysis: SERPAnalysis): Promise<string> {
    const prompt = `Generate an SEO-optimized title for an article about "${keyword}".

Requirements:
- Maximum 60 characters
- Include the primary keyword naturally
- Make it compelling and click-worthy
- Match ${serpAnalysis.userIntent} search intent
- Current year (2025) if relevant
- No clickbait or sensationalism

Competitor titles for reference:
${serpAnalysis.topCompetitors.slice(0, 3).map(c => `- ${c.title}`).join('\n')}

Output ONLY the title, nothing else.`;

    const result = await this.engine.generateWithModel({
      prompt,
      model: this.config.primaryModel || 'gemini',
      apiKeys: this.config.apiKeys,
      temperature: 0.7,
      maxTokens: 100
    });

    return result.content.trim().replace(/^["']|["']$/g, '');
  }

  private async generateMainContent(
    keyword: string,
    title: string,
    serpAnalysis: SERPAnalysis,
    videos: YouTubeVideo[],
    references: Reference[],
    options: GenerationOptions
  ): Promise<string> {
    const targetWordCount = options.targetWordCount || serpAnalysis.recommendedWordCount || 2500;
    
    const systemPrompt = `You are a WORLD-CLASS content strategist who writes like Alex Hormozi meets Tim Ferriss. Your writing is IMPOSSIBLE to detect as AI because it breaks every AI pattern:

🔥 THE HORMOZI-FERRISS FUSION STYLE:

HORMOZI DNA:
- Punch readers in the face with VALUE in the first sentence
- "I" and "you" in every paragraph - this is a conversation, not a lecture
- SPECIFIC numbers that prove credibility: "After testing 847 variations..." or "This saved our client $147,293..."
- Short sentences. Punchy. Direct. No fluff.
- Paragraphs max 3 sentences - wall of text = death
- Bold contrarian takes that make people stop scrolling
- Stories with specific details: names, dates, exact amounts

FERRISS DNA:
- Counterintuitive insights that challenge conventional wisdom
- "What if the opposite were true?" framing
- Specific tactical frameworks readers can implement TODAY
- Real experiments with measurable outcomes
- Name-drop specific tools, books, people (not generically)
- Question everything the reader assumes

🚫 AI DETECTION KILLERS (NEVER USE THESE - INSTANT RED FLAG):
- "In today's fast-paced world" / "In this comprehensive guide" / "Let's dive in"
- "Furthermore" / "Moreover" / "In conclusion" / "It's worth noting"
- "Delve" / "Explore" / "Landscape" / "Realm" / "Crucial" / "Vital"
- "Leverage" / "Utilize" / "Facilitate" / "Implement" / "Navigate"
- "Game-changer" / "Revolutionary" / "Cutting-edge" / "State-of-the-art"
- "Seamlessly" / "Effortlessly" / "Meticulously" / "Holistic" / "Robust"
- Starting sentences with "This" or "It" repeatedly
- "Whether you're a... or a..." constructions
- Any sentence that sounds like corporate AI slop

✅ HUMAN WRITING PATTERNS:
- Start sentences with "Look," / "Here's the thing:" / "Real talk:" / "I'll be honest:"
- Use incomplete sentences for emphasis. Like this.
- Include personal opinions: "Honestly? Most advice on this is garbage."
- Show frustration: "This drives me insane about the industry..."
- Admit uncertainty: "I could be wrong here, but..."
- Use contractions everywhere: don't, won't, can't, it's, that's
- Rhetorical questions: "Sound familiar?"
- Informal transitions: "Anyway," / "So here's what happened:" / "Point is:"
- Slang and casual phrases: "zero chance" / "dead wrong" / "the real kicker"

📐 STRUCTURE REQUIREMENTS:

1. HOOK SECTION (first 100 words): 
Start with a bold statement, shocking stat, or controversial opinion. NO "welcome to" or "in this article."

2. KEY TAKEAWAYS BOX (after hook):
<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px; padding: 24px; margin: 24px 0;">
  <h3 style="color: white; margin-top: 0; font-size: 20px;">🎯 Key Takeaways</h3>
  <ul style="color: white; margin: 0; padding-left: 20px;">
    <li>Takeaway 1</li>
    <li>Takeaway 2</li>
  </ul>
</div>

3. PRO TIP BOXES (3+ throughout):
<div style="background: #1e40af; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 20px 0; border-radius: 0 12px 12px 0;">
  <strong style="color: #60a5fa;">💡 Pro Tip:</strong>
  <span style="color: #e0e7ff;"> Your tip here</span>
</div>

4. WARNING BOXES (when relevant):
<div style="background: #dc2626; border-left: 4px solid #f87171; padding: 16px 20px; margin: 20px 0; border-radius: 0 12px 12px 0;">
  <strong style="color: white;">⚠️ Warning:</strong>
  <span style="color: #fecaca;"> Critical warning</span>
</div>

5. DATA TABLE (at least 1):
<table style="width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 12px; overflow: hidden;">
  <thead>
    <tr style="background: #1f2937;">
      <th style="padding: 14px; text-align: left; color: white; border-bottom: 2px solid #374151;">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background: #111827;">
      <td style="padding: 12px; color: #d1d5db; border-bottom: 1px solid #374151;">Data</td>
    </tr>
  </tbody>
</table>

6. STEP BOXES (for how-to):
<div style="background: #1e293b; border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #334155;">
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
    <span style="background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">1</span>
    <strong style="color: white;">Step Title</strong>
  </div>
  <p style="color: #94a3b8; margin: 0; padding-left: 44px;">Step description</p>
</div>

OUTPUT: Pure HTML only. No markdown. Proper h2/h3 hierarchy. Every paragraph must deliver VALUE.`;

    const prompt = `Write a ${targetWordCount}+ word article about "${keyword}".

TITLE: ${title}

STRUCTURE:
${serpAnalysis.recommendedHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

CONTENT GAPS TO FILL (competitors missed these):
${serpAnalysis.contentGaps.slice(0, 5).join('\n')}

SEMANTIC KEYWORDS TO WEAVE IN:
${serpAnalysis.semanticEntities.slice(0, 15).join(', ')}

${videos.length > 0 ? `
EMBED THIS VIDEO:
<div style="position: relative; padding-bottom: 56.25%; height: 0; margin: 32px 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
  <iframe src="https://www.youtube.com/embed/${videos[0].id}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="${videos[0].title}"></iframe>
</div>
<p style="text-align: center; color: #9ca3af; font-size: 14px; margin-top: 8px;">📺 <strong>${videos[0].title}</strong> by ${videos[0].channelTitle}</p>
` : ''}

REQUIREMENTS:
1. First 2 sentences MUST be compelling - no "welcome" or "in this article"
2. Key Takeaways box right after intro
3. At least 3 Pro Tip boxes
4. At least 1 data table
5. FAQ section with 6-8 questions
6. Strong CTA at the end
7. Write like you're helping a friend - conversational but expert

Write the article now. Make it so valuable people bookmark it.`;

    let result;
    if (this.config.useConsensus && this.engine.getAvailableModels().length > 1) {
      this.log('Using multi-model consensus generation...');
      const consensusResult = await this.engine.generateWithConsensus(prompt, systemPrompt);
      result = { content: consensusResult.finalContent };
    } else {
      result = await this.engine.generateWithModel({
        prompt,
        model: this.config.primaryModel || 'gemini',
        apiKeys: this.config.apiKeys,
        systemPrompt,
        temperature: 0.75,
        maxTokens: 8192
      });
    }

    // Add videos section if available and not already embedded
    let finalContent = result.content;
    if (videos.length > 0 && !finalContent.includes('youtube.com/embed')) {
      const videoSection = this.buildVideoSection(videos);
      finalContent = this.insertBeforeConclusion(finalContent, videoSection);
      this.log('Injected YouTube video section');
    }

    // Add references section
    if (references.length > 0) {
      const referencesSection = this.referenceService.formatReferencesSection(references);
      finalContent += referencesSection;
      this.log(`Added ${references.length} references`);
    }

    return finalContent;
  }

  private buildVideoSection(videos: YouTubeVideo[]): string {
    return `
<section class="video-resources" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%); border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid rgba(34, 197, 94, 0.2);">
  <h2 style="margin-top: 0; display: flex; align-items: center; gap: 12px;">
    <span style="font-size: 24px;">📺</span> Recommended Video Resources
  </h2>
  <p style="color: #888; margin-bottom: 24px;">Learn more about this topic with these expert video guides:</p>
  ${videos.map(v => this.youtubeService.formatVideoCard(v)).join('')}
</section>
`;
  }

  private insertBeforeConclusion(content: string, section: string): string {
    // Try to insert before conclusion or FAQ
    const conclusionPatterns = [
      /<h2[^>]*>\s*(?:conclusion|final thoughts|wrapping up)/i,
      /<h2[^>]*>\s*(?:faq|frequently asked)/i
    ];

    for (const pattern of conclusionPatterns) {
      const match = content.match(pattern);
      if (match && match.index !== undefined) {
        return content.slice(0, match.index) + section + content.slice(match.index);
      }
    }

    // If no conclusion found, add before closing
    return content + section;
  }

  private async generateMetaDescription(keyword: string, title: string): Promise<string> {
    const prompt = `Write an SEO meta description for an article titled "${title}" about "${keyword}".

Requirements:
- Exactly 150-160 characters
- Include the primary keyword naturally
- Include a call-to-action
- Compelling and click-worthy
- No fluff or filler words

Output ONLY the meta description.`;

    const result = await this.engine.generateWithModel({
      prompt,
      model: this.config.primaryModel || 'gemini',
      apiKeys: this.config.apiKeys,
      temperature: 0.7,
      maxTokens: 100
    });

    return result.content.trim().replace(/^["']|["']$/g, '');
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
  }

  private buildEEATProfile(references: Reference[]): EEATProfile {
    return {
      author: {
        name: this.config.authorName,
        credentials: this.config.authorCredentials || [],
        publications: [],
        expertiseAreas: [],
        socialProfiles: []
      },
      citations: references.map(r => ({
        title: r.title,
        url: r.url,
        type: r.type
      })),
      expertReviews: [],
      methodology: 'AI-assisted research with human editorial oversight',
      lastUpdated: new Date(),
      factChecked: references.length > 3
    };
  }

  async generateContentPlan(broadTopic: string): Promise<ContentPlan> {
    this.log(`Generating content plan for: ${broadTopic}`);

    const prompt = `Create a comprehensive content cluster plan for the topic: "${broadTopic}"

Generate:
1. A pillar page keyword (main comprehensive topic)
2. 8-12 cluster article keywords that support the pillar

For each cluster, specify:
- Primary keyword (2-4 words)
- Suggested title
- Content type (how-to, guide, comparison, listicle, deep-dive)
- Priority (high, medium, low based on search volume potential)

Output as JSON:
{
  "pillarKeyword": "...",
  "pillarTitle": "...",
  "clusters": [
    {
      "keyword": "...",
      "title": "...",
      "type": "guide",
      "priority": "high"
    }
  ]
}

Output ONLY valid JSON.`;

    const result = await this.engine.generateWithModel({
      prompt,
      model: this.config.primaryModel || 'gemini',
      apiKeys: this.config.apiKeys,
      temperature: 0.7,
      maxTokens: 2000
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        pillarTopic: broadTopic,
        pillarKeyword: parsed.pillarKeyword,
        clusters: parsed.clusters.map((c: Record<string, unknown>) => ({
          keyword: c.keyword as string,
          title: c.title as string,
          type: (c.type as ContentPlan['clusters'][0]['type']) || 'guide',
          priority: (c.priority as ContentPlan['clusters'][0]['priority']) || 'medium'
        })),
        totalEstimatedWords: (parsed.clusters.length + 1) * 2500,
        estimatedTimeToComplete: `${Math.ceil((parsed.clusters.length + 1) * 15 / 60)} hours`
      };
    } catch (error) {
      this.log(`Error parsing content plan: ${error}`);
      return {
        pillarTopic: broadTopic,
        pillarKeyword: broadTopic,
        clusters: [
          { keyword: `${broadTopic} guide`, title: `Complete ${broadTopic} Guide`, type: 'guide', priority: 'high' },
          { keyword: `${broadTopic} tips`, title: `Top ${broadTopic} Tips`, type: 'listicle', priority: 'high' },
          { keyword: `how to ${broadTopic}`, title: `How to ${broadTopic}`, type: 'how-to', priority: 'medium' },
          { keyword: `${broadTopic} best practices`, title: `${broadTopic} Best Practices`, type: 'deep-dive', priority: 'medium' }
        ],
        totalEstimatedWords: 12500,
        estimatedTimeToComplete: '3 hours'
      };
    }
  }

  getCacheStats(): { size: number; hitRate: number } {
    return generationCache.getStats();
  }

  hasAvailableModels(): boolean {
    return this.engine.hasAvailableModel();
  }

  getAvailableModels(): AIModel[] {
    return this.engine.getAvailableModels();
  }
}

export function createOrchestrator(config: OrchestratorConfig): EnterpriseContentOrchestrator {
  return new EnterpriseContentOrchestrator(config);
}
