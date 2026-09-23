export type ProjectStatus = 'draft' | 'processing' | 'ready' | 'approved' | 'published' | 'failed';
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
  role: 'original';
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  media: {
    id: string;
    mimeType: string;
  } | null;
}

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
