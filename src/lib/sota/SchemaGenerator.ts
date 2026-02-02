// ============================================================
// SCHEMA GENERATOR - Schema.org Structured Data Automation
// ============================================================

import type { SchemaMarkup, SchemaEntity, EEATProfile, GeneratedContent } from './types';

export interface ArticleSchemaParams {
  title: string;
  description: string;
  content: string;
  author: EEATProfile['author'];
  datePublished: Date;
  dateModified?: Date;
  url: string;
  imageUrl?: string;
  organizationName: string;
  logoUrl?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  name: string;
  text: string;
  imageUrl?: string;
}

export class SchemaGenerator {
  private organizationName: string;
  private organizationUrl: string;
  private logoUrl: string;

  constructor(organizationName: string, organizationUrl: string, logoUrl: string = '') {
    this.organizationName = organizationName;
    this.organizationUrl = organizationUrl;
    this.logoUrl = logoUrl;
  }

  generateComprehensiveSchema(content: GeneratedContent, url: string): SchemaMarkup {
    const graph: SchemaEntity[] = [];

    // Add Organization
    graph.push(this.generateOrganizationSchema());

    // Add WebSite
    graph.push(this.generateWebSiteSchema());

    // Add Article
    graph.push(this.generateArticleSchema({
      title: content.title,
      description: content.metaDescription,
      content: content.content,
      author: content.eeat.author,
      datePublished: content.generatedAt,
      url,
      organizationName: this.organizationName,
      logoUrl: this.logoUrl
    }));

    // Add BreadcrumbList
    graph.push(this.generateBreadcrumbSchema(url, content.title));

    // Extract and add FAQ if present
    const faqs = this.extractFAQsFromContent(content.content);
    if (faqs.length > 0) {
      graph.push(this.generateFAQSchema(faqs));
    }

    // Extract and add HowTo if present
    const steps = this.extractHowToSteps(content.content);
    if (steps.length > 0) {
      graph.push(this.generateHowToSchema(content.title, steps));
    }

    // Add Author
    graph.push(this.generateAuthorSchema(content.eeat.author));

    return {
      '@context': 'https://schema.org',
      '@graph': graph
    };
  }

  generateOrganizationSchema(): SchemaEntity {
    return {
      '@type': 'Organization',
      '@id': `${this.organizationUrl}/#organization`,
      'name': this.organizationName,
      'url': this.organizationUrl,
      ...(this.logoUrl && {
        'logo': {
          '@type': 'ImageObject',
          'url': this.logoUrl
        }
      })
    };
  }

  generateWebSiteSchema(): SchemaEntity {
    return {
      '@type': 'WebSite',
      '@id': `${this.organizationUrl}/#website`,
      'url': this.organizationUrl,
      'name': this.organizationName,
      'publisher': {
        '@id': `${this.organizationUrl}/#organization`
      }
    };
  }

  generateArticleSchema(params: ArticleSchemaParams): SchemaEntity {
    return {
      '@type': 'Article',
      '@id': `${params.url}/#article`,
      'headline': params.title,
      'description': params.description,
      'datePublished': params.datePublished.toISOString(),
      'dateModified': (params.dateModified || params.datePublished).toISOString(),
      'author': {
        '@type': 'Person',
        'name': params.author.name,
        ...(params.author.credentials.length > 0 && {
          'jobTitle': params.author.credentials[0]
        })
      },
      'publisher': {
        '@id': `${this.organizationUrl}/#organization`
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': params.url
      },
      ...(params.imageUrl && {
        'image': {
          '@type': 'ImageObject',
          'url': params.imageUrl
        }
      }),
      'wordCount': this.countWords(params.content),
      'articleBody': this.stripHtml(params.content).slice(0, 500)
    };
  }

  generateFAQSchema(faqs: FAQItem[]): SchemaEntity {
    return {
      '@type': 'FAQPage',
      'mainEntity': faqs.map(faq => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.answer
        }
      }))
    };
  }

  generateHowToSchema(title: string, steps: HowToStep[]): SchemaEntity {
    return {
      '@type': 'HowTo',
      'name': title,
      'step': steps.map((step, index) => ({
        '@type': 'HowToStep',
        'position': index + 1,
        'name': step.name,
        'text': step.text,
        ...(step.imageUrl && {
          'image': {
            '@type': 'ImageObject',
            'url': step.imageUrl
          }
        })
      }))
    };
  }

  generateBreadcrumbSchema(url: string, title: string): SchemaEntity {
    const urlParts = url.replace(this.organizationUrl, '').split('/').filter(p => p);
    
    const items = [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': this.organizationUrl
      }
    ];

    let currentPath = this.organizationUrl;
    urlParts.forEach((part, index) => {
      currentPath += `/${part}`;
      items.push({
        '@type': 'ListItem',
        'position': index + 2,
        'name': index === urlParts.length - 1 ? title : part.replace(/-/g, ' '),
        'item': currentPath
      });
    });

    return {
      '@type': 'BreadcrumbList',
      'itemListElement': items
    };
  }

  generateAuthorSchema(author: EEATProfile['author']): SchemaEntity {
    return {
      '@type': 'Person',
      'name': author.name,
      ...(author.credentials.length > 0 && {
        'jobTitle': author.credentials[0]
      }),
      ...(author.expertiseAreas.length > 0 && {
        'knowsAbout': author.expertiseAreas
      }),
      ...(author.socialProfiles.length > 0 && {
        'sameAs': author.socialProfiles.map(p => p.url)
      })
    };
  }

  generateReviewSchema(reviewerName: string, rating: number, reviewBody: string): SchemaEntity {
    return {
      '@type': 'Review',
      'author': {
        '@type': 'Person',
        'name': reviewerName
      },
      'reviewRating': {
        '@type': 'Rating',
        'ratingValue': rating,
        'bestRating': 5
      },
      'reviewBody': reviewBody
    };
  }

  generateProductSchema(
    name: string,
    description: string,
    imageUrl: string,
    price?: number,
    currency?: string
  ): SchemaEntity {
    return {
      '@type': 'Product',
      'name': name,
      'description': description,
      'image': imageUrl,
      ...(price !== undefined && currency && {
        'offers': {
          '@type': 'Offer',
          'price': price,
          'priceCurrency': currency
        }
      })
    };
  }

  private extractFAQsFromContent(content: string): FAQItem[] {
    const faqs: FAQItem[] = [];
    
    // Look for FAQ patterns
    const faqPatterns = [
      /<h[23][^>]*>\s*(?:Q:|Question:?)?\s*(.+?)<\/h[23]>\s*<p>(.+?)<\/p>/gi,
      /<strong>\s*(?:Q:|Question:?)?\s*(.+?)<\/strong>\s*<p>(.+?)<\/p>/gi
    ];

    faqPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && match[2]) {
          faqs.push({
            question: this.stripHtml(match[1]).trim(),
            answer: this.stripHtml(match[2]).trim()
          });
        }
      }
    });

    return faqs.slice(0, 10);
  }

  private extractHowToSteps(content: string): HowToStep[] {
    const steps: HowToStep[] = [];
    
    // Look for numbered steps
    const stepPattern = /<li[^>]*>\s*(?:<strong>)?(?:Step\s*\d+[:.])?\s*(.+?)(?:<\/strong>)?(?:<\/li>|<br)/gi;
    
    let match;
    while ((match = stepPattern.exec(content)) !== null) {
      if (match[1]) {
        const text = this.stripHtml(match[1]).trim();
        if (text.length > 10) {
          steps.push({
            name: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
            text: text
          });
        }
      }
    }

    return steps.slice(0, 10);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private countWords(content: string): number {
    return this.stripHtml(content).split(/\s+/).filter(w => w.length > 0).length;
  }

  toScriptTag(schema: SchemaMarkup): string {
    return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
  }
}

export function createSchemaGenerator(
  organizationName: string,
  organizationUrl: string,
  logoUrl?: string
): SchemaGenerator {
  return new SchemaGenerator(organizationName, organizationUrl, logoUrl || '');
}
