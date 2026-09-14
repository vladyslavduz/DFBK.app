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
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface Project {
  id: string;
  userId: string;
  title?: string;
  location?: string;
  trade?: string;
  notes?: string;
  status: ProjectStatus;
  createdAt: string;
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
