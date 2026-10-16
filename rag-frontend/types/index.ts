export interface Citation {
  documentName: string;
  pageNumber?: number;
  textChunk: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp?: Date;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface StorageStats {
  total_chunks_indexed: number;
  estimated_memory_used: string;
  free_tier_limit: string;
  usage_percentage: string;
  capacity_remaining: string;
}