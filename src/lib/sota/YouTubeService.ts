// ============================================================
// YOUTUBE SERVICE - Video Reference Integration
// ============================================================

import type { YouTubeVideo } from './types';

export class YouTubeService {
  private serperApiKey: string;

  constructor(serperApiKey: string) {
    this.serperApiKey = serperApiKey;
  }

  async searchVideos(query: string, maxResults: number = 5): Promise<YouTubeVideo[]> {
    if (!this.serperApiKey) {
      console.warn('No Serper API key provided for YouTube search');
      return [];
    }

    try {
      const response = await fetch('https://google.serper.dev/videos', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: maxResults
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = await response.json();
      const videos = data.videos || [];

      return videos.slice(0, maxResults).map((video: Record<string, unknown>) => ({
        id: this.extractVideoId(video.link as string || ''),
        title: video.title as string || '',
        channelTitle: video.channel as string || '',
        description: video.snippet as string || '',
        thumbnailUrl: video.imageUrl as string || '',
        publishedAt: video.date as string || '',
        viewCount: undefined,
        duration: video.duration as string || undefined
      }));
    } catch (error) {
      console.error('Error searching YouTube videos:', error);
      return [];
    }
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match?.[1] || '';
  }

  formatVideoEmbed(video: YouTubeVideo): string {
    return `
<div class="video-embed" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin: 24px 0;">
  <iframe 
    src="https://www.youtube.com/embed/${video.id}" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen
    title="${video.title}"
  ></iframe>
</div>
<p style="font-size: 14px; color: #666; margin-top: 8px;">📺 <strong>${video.title}</strong> by ${video.channelTitle}</p>
`;
  }

  formatVideoCard(video: YouTubeVideo): string {
    return `
<div class="video-card" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 20px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
  <div style="display: flex; gap: 16px; align-items: flex-start;">
    <img src="${video.thumbnailUrl}" alt="${video.title}" style="width: 160px; height: 90px; object-fit: cover; border-radius: 8px;">
    <div style="flex: 1;">
      <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
        <a href="https://youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer" style="color: #fff; text-decoration: none;">
          ${video.title}
        </a>
      </h4>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #888;">${video.channelTitle}</p>
      <p style="margin: 0; font-size: 14px; color: #aaa; line-height: 1.5;">${video.description?.slice(0, 120)}...</p>
    </div>
  </div>
</div>
`;
  }

  async getRelevantVideos(keyword: string, contentType: string = 'guide'): Promise<YouTubeVideo[]> {
    const searchQueries = [
      `${keyword} tutorial`,
      `${keyword} explained`,
      `${keyword} ${contentType}`,
      `how to ${keyword}`,
      `${keyword} 2025`
    ];

    // Use the most relevant query based on content type
    const query = contentType === 'how-to' 
      ? searchQueries[3] 
      : contentType === 'guide'
        ? searchQueries[1]
        : searchQueries[0];

    return this.searchVideos(query, 3);
  }
}

export function createYouTubeService(serperApiKey: string): YouTubeService {
  return new YouTubeService(serperApiKey);
}
