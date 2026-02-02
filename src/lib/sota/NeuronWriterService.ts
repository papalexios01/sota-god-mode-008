// ============================================================
// NEURONWRITER SERVICE - Enterprise NeuronWriter Integration
// ============================================================

export interface NeuronWriterProject {
  id: string;
  name: string;
  created_at?: string;
  queries_count?: number;
}

export interface NeuronWriterQuery {
  id: string;
  query: string;
  status: 'ready' | 'processing' | 'error';
  created_at?: string;
  lang?: string;
  location?: string;
}

export interface NeuronWriterAnalysis {
  query_id: string;
  keyword: string;
  terms: NeuronWriterTerm[];
  competitors: NeuronWriterCompetitor[];
  recommended_length: number;
  content_score?: number;
}

export interface NeuronWriterTerm {
  term: string;
  weight: number;
  frequency: number;
  type: 'required' | 'recommended' | 'optional';
}

export interface NeuronWriterCompetitor {
  url: string;
  title: string;
  word_count: number;
  score: number;
}

// Determine the best proxy URL for NeuronWriter API calls
function getProxyUrl(): string {
  // Check for Supabase functions first
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/neuronwriter-proxy`;
  }
  
  // Fallback to Cloudflare Pages functions
  return '/api/neuronwriter';
}

export class NeuronWriterService {
  private apiKey: string;
  private proxyUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
    this.proxyUrl = getProxyUrl();
  }

  private async makeRequest<T>(
    endpoint: string,
    method: string = 'POST',
    body?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NeuronWriter-Key': this.apiKey,
        },
        body: JSON.stringify({
          endpoint,
          method,
          apiKey: this.apiKey,
          body,
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.error || `API error: ${result.status}` 
        };
      }

      return { 
        success: true, 
        data: result.data as T 
      };
    } catch (error) {
      console.error('[NeuronWriter] Request failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Validate API key by attempting to list projects
   */
  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    const result = await this.listProjects();
    return { 
      valid: result.success, 
      error: result.error 
    };
  }

  /**
   * List all projects for the account
   */
  async listProjects(): Promise<{ success: boolean; projects?: NeuronWriterProject[]; error?: string }> {
    const result = await this.makeRequest<{ projects: NeuronWriterProject[] }>(
      '/list-projects',
      'GET'
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const projects = result.data?.projects || [];
    return { 
      success: true, 
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        created_at: p.created_at,
        queries_count: p.queries_count
      }))
    };
  }

  /**
   * List queries for a specific project
   */
  async listQueries(projectId: string): Promise<{ success: boolean; queries?: NeuronWriterQuery[]; error?: string }> {
    const result = await this.makeRequest<{ queries: NeuronWriterQuery[] }>(
      '/list-queries',
      'POST',
      { project: projectId }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const queries = result.data?.queries || [];
    return { 
      success: true, 
      queries: queries.map(q => ({
        id: q.id,
        query: q.query,
        status: q.status,
        created_at: q.created_at,
        lang: q.lang,
        location: q.location
      }))
    };
  }

  /**
   * Create a new query (keyword analysis)
   */
  async createQuery(
    projectId: string,
    keyword: string,
    language: string = 'en',
    location: string = 'United States'
  ): Promise<{ success: boolean; queryId?: string; error?: string }> {
    const result = await this.makeRequest<{ query_id: string; status: string }>(
      '/new-query',
      'POST',
      { 
        project: projectId,
        query: keyword,
        lang: language,
        location: location
      }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { 
      success: true, 
      queryId: result.data?.query_id 
    };
  }

  /**
   * Get query analysis data
   */
  async getQueryAnalysis(queryId: string): Promise<{ success: boolean; analysis?: NeuronWriterAnalysis; error?: string }> {
    const result = await this.makeRequest<NeuronWriterAnalysis>(
      '/get-query',
      'POST',
      { query: queryId }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { 
      success: true, 
      analysis: result.data 
    };
  }

  /**
   * Get recommended terms for content optimization
   */
  async getRecommendedTerms(queryId: string): Promise<{ success: boolean; terms?: NeuronWriterTerm[]; error?: string }> {
    const analysisResult = await this.getQueryAnalysis(queryId);
    
    if (!analysisResult.success) {
      return { success: false, error: analysisResult.error };
    }

    return { 
      success: true, 
      terms: analysisResult.analysis?.terms || [] 
    };
  }

  /**
   * Calculate content score against NeuronWriter optimization targets
   */
  calculateContentScore(content: string, terms: NeuronWriterTerm[]): number {
    const contentLower = content.toLowerCase();
    let totalWeight = 0;
    let achievedWeight = 0;

    terms.forEach(term => {
      const termLower = term.term.toLowerCase();
      const count = (contentLower.match(new RegExp(termLower, 'gi')) || []).length;
      
      totalWeight += term.weight;
      
      // Score based on whether term is present with appropriate frequency
      if (count >= term.frequency) {
        achievedWeight += term.weight;
      } else if (count > 0) {
        achievedWeight += (term.weight * count) / term.frequency;
      }
    });

    return totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;
  }

  /**
   * Get optimization suggestions based on terms
   */
  getOptimizationSuggestions(content: string, terms: NeuronWriterTerm[]): string[] {
    const suggestions: string[] = [];
    const contentLower = content.toLowerCase();

    terms.forEach(term => {
      const termLower = term.term.toLowerCase();
      const count = (contentLower.match(new RegExp(termLower, 'gi')) || []).length;
      
      if (term.type === 'required' && count < term.frequency) {
        suggestions.push(`Add "${term.term}" (${count}/${term.frequency} times, weight: ${term.weight})`);
      } else if (term.type === 'recommended' && count === 0) {
        suggestions.push(`Consider adding "${term.term}" (recommended term)`);
      }
    });

    return suggestions.slice(0, 20);
  }
}

export function createNeuronWriterService(apiKey: string): NeuronWriterService {
  return new NeuronWriterService(apiKey);
}

// Singleton for reuse
let serviceInstance: NeuronWriterService | null = null;

export function getNeuronWriterService(apiKey?: string): NeuronWriterService | null {
  if (apiKey) {
    serviceInstance = new NeuronWriterService(apiKey);
  }
  return serviceInstance;
}
