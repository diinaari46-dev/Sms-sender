export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'paused';

export type CampaignStatus =
  | 'draft'
  | 'pending'
  | 'queued'
  | 'running'
  | 'sending'
  | 'paused'
  | 'done'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  created_at?: string;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  created_at?: string;
}

export interface Campaign {
  id: string;
  title: string;
  template_body: string;
  total: number;
  status: CampaignStatus | string;
  created_at: string;
}

export interface OutboxMessage {
  id: string;
  campaign_id: string | null;
  customer_id: string | null;
  phone: string;
  message: string;
  status: OutboxStatus;
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
}

export interface GatewayConfig {
  user_id?: string;
  is_enabled: boolean;
  min_delay_ms: number;
  max_delay_ms: number;
  daily_limit: number;
  last_seen: string | null;
  battery: number | null;
  company_name?: string | null;
}

export type PageRoute = 'dashboard' | 'customers' | 'send' | 'campaigns' | 'settings';

export type Language = 'so' | 'en';
