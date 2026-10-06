export type ProjectStatus = 'draft' | 'processing' | 'ready' | 'finished' | 'failed';
export type ProjectTitleSource = 'system' | 'auto' | 'manual';
export type PhotoOptimizationState = 'available' | 'processing' | 'completed';
export type Channel = 'google_business' | 'instagram' | 'facebook' | 'telegram' | 'website' | 'blog';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  businessName: string;
  trade: string;
  serviceArea?: string;
  services?: string[];
  phone?: string;
  website?: string;
  tone?: 'professional' | 'direct' | 'casual';
}

export interface MediaAsset {
  id: string;
  projectId: string;
  mediaType: 'image';
  role: 'original' | 'optimized';
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export type ProjectMediaRef = {
  id: string;
  mimeType: string;
};

export type ProjectMedia = {
  original: ProjectMediaRef | null;
  optimized: ProjectMediaRef | null;
};

export type ProjectPhotoOptimization = {
  state: PhotoOptimizationState;
};

export type ProjectMediaResponse = {
  ok: true;
  media: ProjectMedia;
  photoOptimization: ProjectPhotoOptimization;
};

export type ProjectOptimizeResponse = {
  ok: true;
  optimized: ProjectMediaRef;
};

export interface Project {
  id: string;
  title: string;
  titleSource: ProjectTitleSource;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  media: ProjectMediaRef | null;
  photoOptimization: ProjectPhotoOptimization;
}

export interface ProjectGeneratedContent {
  googleBusiness: string | null;
  socialMedia: string | null;
  websiteReference: string | null;
}

export type ProjectContentResponse = {
  ok: true;
  content: ProjectGeneratedContent | null;
};

export type ProjectGenerationResponse = {
  ok: true;
  project: Project;
  content: ProjectGeneratedContent;
};

export interface GeneratedContent {
  id: string;
  projectId: string;
  channel: Channel;
  title?: string;
  text: string;
  hashtags?: string[];
  createdAt: string;
}

export interface Integration {
  id: string;
  userId: string;
  channel: Channel | 'email' | 'billing';
  status: 'disconnected' | 'connected' | 'error';
}

export interface Publication {
  id: string;
  projectId: string;
  channel: Channel;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  externalId?: string;
  publishedAt?: string;
}
