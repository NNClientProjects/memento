import type { CommChannel } from '@/lib/lifecycle';

export type TemplateStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type Template = {
  id: string;
  event_id: string;
  channel: CommChannel;
  name: string;
  subject: string | null;
  body: string;
  merge_fields: string[];
  provider_template_id: string | null;
  provider_language_code: string;
  status: TemplateStatus;
  created_at: string;
  updated_at: string;
};

export type CommStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type CommDirection = 'outbound' | 'inbound';

export type Communication = {
  id: string;
  event_id: string;
  participant_id: string | null;
  channel: CommChannel;
  direction: CommDirection;
  template_id: string | null;
  subject: string | null;
  body: string | null;
  status: CommStatus;
  external_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};
