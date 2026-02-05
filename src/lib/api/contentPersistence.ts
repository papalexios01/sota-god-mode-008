import type { GeneratedContentStore } from '../store';

export interface PersistedBlogPost {
  id: string;
  item_id: string;
  title: string;
  seo_title?: string;
  content: string;
  meta_description: string;
  slug: string;
  primary_keyword: string;
  secondary_keywords: string[];
  word_count: number;
  quality_score: {
    overall: number;
    readability: number;
    seo: number;
    eeat: number;
    uniqueness: number;
    factAccuracy: number;
  };
  internal_links: Array<{ anchorText?: string; anchor?: string; targetUrl: string; context: string }>;
  schema?: unknown;
  serp_analysis?: {
    avgWordCount: number;
    recommendedWordCount: number;
    userIntent: string;
  };
  neuronwriter_query_id?: string;
  generated_at: string;
  model: string;
  created_at?: string;
  updated_at?: string;
}

export async function ensureTableExists(): Promise<boolean> {
  try {
    const response = await fetch('/api/blog-posts');
    return response.ok;
  } catch (err) {
    console.error('[ContentPersistence] Connection error:', err);
    return false;
  }
}

export async function loadAllBlogPosts(): Promise<GeneratedContentStore> {
  try {
    const response = await fetch('/api/blog-posts');
    if (!response.ok) {
      console.error('[ContentPersistence] Load error:', response.statusText);
      return {};
    }

    const result = await response.json();
    if (!result.success) {
      console.error('[ContentPersistence] Load error:', result.error);
      return {};
    }

    console.log(`[ContentPersistence] Loaded ${Object.keys(result.data || {}).length} blog posts from database`);
    return result.data || {};
  } catch (err) {
    console.error('[ContentPersistence] Load exception:', err);
    return {};
  }
}

export async function saveBlogPost(itemId: string, content: GeneratedContentStore[string]): Promise<boolean> {
  try {
    const response = await fetch('/api/blog-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, content }),
    });

    if (!response.ok) {
      console.error('[ContentPersistence] Save error:', response.statusText);
      return false;
    }

    const result = await response.json();
    if (!result.success) {
      console.error('[ContentPersistence] Save error:', result.error);
      return false;
    }

    console.log(`[ContentPersistence] Saved blog post: ${content.title}`);
    return true;
  } catch (err) {
    console.error('[ContentPersistence] Save exception:', err);
    return false;
  }
}

export async function deleteBlogPost(itemId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/blog-posts/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      console.error('[ContentPersistence] Delete error:', response.statusText);
      return false;
    }

    const result = await response.json();
    if (!result.success) {
      console.error('[ContentPersistence] Delete error:', result.error);
      return false;
    }

    console.log(`[ContentPersistence] Deleted blog post: ${itemId}`);
    return true;
  } catch (err) {
    console.error('[ContentPersistence] Delete exception:', err);
    return false;
  }
}
