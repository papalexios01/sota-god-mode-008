// ============================================================
// SOTA Library Index - Export All Modules
// ============================================================

// Types
export * from './types';

// Core Engines
export { SOTAContentGenerationEngine, createSOTAEngine } from './SOTAContentGenerationEngine';
export { EnterpriseContentOrchestrator, createOrchestrator } from './EnterpriseContentOrchestrator';

// Services
export { YouTubeService, createYouTubeService } from './YouTubeService';
export { ReferenceService, createReferenceService } from './ReferenceService';
export { SERPAnalyzer, createSERPAnalyzer } from './SERPAnalyzer';
export { SchemaGenerator, createSchemaGenerator } from './SchemaGenerator';
export { SOTAInternalLinkEngine, createInternalLinkEngine } from './SOTAInternalLinkEngine';

// Validation & Quality
export { 
  calculateQualityScore, 
  analyzeContent, 
  detectAITriggerPhrases,
  removeAIPhrases,
  calculateKeywordDensity 
} from './QualityValidator';

// Caching
export { generationCache, serpCache, schemaCache, validationCache } from './cache';

// Performance Tracking
export { 
  globalPerformanceTracker,
  calculateAEOScore,
  calculateSemanticRichness,
  calculateLinkDensity
} from './PerformanceTracker';
