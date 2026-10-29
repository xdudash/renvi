// Typed wrappers over the admin RPCs (supabase/migrations/0023_admin_complete.sql).
// Every RPC re-checks is_admin() on the server and writes the admin audit log; the client only renders.
import { supabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';

// Extends AppError so useAsync keeps the server's message (admins need the real reason, not a generic text).
export class AdminError extends AppError {
  code?: string;
  constructor(message: string, code?: string) {
    super(code === '42501' ? 'unauthorized' : code === 'P0002' ? 'not_found' : 'server', message);
    this.code = code;
  }
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new AdminError(error.message, error.code);
  return data as T;
}

export type Page<T> = { total: number; rows: T[] };
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type Verification = 'none' | 'pending' | 'approved' | 'rejected';

export type CountryRow = {
  country: string; users: number; published: number; new_week: number; active_today: number;
  suspended: number; banned: number; reports_open: number; appeals_open: number; pending_verifications: number;
};
export type Dashboard = {
  countries: CountryRow[]; reports_open: number; reports_unassigned: number; reports_stale: number;
  appeals_open: number; pending_verifications: number; demo_bots: number; admins: number; paid_subscribers: number;
  missing_legal_urls: string[]; support_email_missing: boolean;
};

export type UserRow = {
  id: string; email: string; display_name: string | null; age: number | null; country: string; city: string | null;
  verification_status: Verification; onboarding_done: boolean; suspended_until: string | null; status: AccountStatus;
  tier: string; created_at: string; reports_open: number; reports_total: number; is_demo: boolean; is_admin: boolean;
  last_active: string | null;
};
export type UserFilter = {
  query?: string | null; country?: string | null; status?: AccountStatus | null; verification?: Verification | null;
  demo?: boolean | null; sort?: 'new' | 'reports' | 'active'; limit: number; offset: number;
};

export type Sanction = {
  id: string; kind: 'warning' | 'suspension' | 'ban'; reason: string; note: string | null; until: string | null;
  created_at: string; lifted_at: string | null; lift_reason: string | null; created_by_email: string | null;
  lifted_by_email: string | null; active: boolean;
};
export type UserDetail = {
  profile: Record<string, unknown> & {
    id: string; display_name: string | null; age: number | null; gender: string | null; seeking: string | null;
    intent: string | null; country: string; city: string | null; bio: string; interests: string[]; language: string | null;
    onboarding_done: boolean; paused: boolean; incognito: boolean; verification_status: Verification;
    suspended_until: string | null; created_at: string;
  };
  email: string; last_sign_in_at: string | null; last_active: string | null; status: AccountStatus;
  is_demo: boolean; is_admin: boolean;
  photos: { id: string; storage_path: string; kind: string; position: number; verified: boolean; created_at: string }[];
  prompts: { id: string; question_key: string; answer: string }[];
  reports_against: { id: string; reason: string; details: string | null; status: string; decision: string | null; created_at: string;
    decided_at: string | null; resolution_note: string | null; message_snapshot: string | null; reporter_id: string; reporter_name: string | null }[];
  reports_by: { id: string; reason: string; details: string | null; status: string; decision: string | null; created_at: string;
    target_profile_id: string | null; target_name: string | null }[];
  sanctions: Sanction[];
  appeals: { id: string; report_id: string; details: string; status: string; created_at: string; decision_reason: string | null; decided_at: string | null }[];
  verification_requests: { id: string; storage_path: string; status: string; created_at: string; decision_reason: string | null; decided_at: string | null }[];
  subscription: { tier: string; store: string | null; expires_at: string | null; sandbox: boolean; updated_at: string; active: boolean } | null;
  stats: { matches_active: number; matches_total: number; sparks_sent: number; sparks_received: number; messages_sent: number; blocked_by: number };
  admin_actions: { id: number; action: string; reason: string | null; details: Record<string, unknown>; created_at: string; admin_email: string | null }[];
};

export type ReportState = 'new' | 'review' | 'resolved';
export type ReportRow = {
  id: string; reason: string; details: string | null; status: 'open' | 'actioned' | 'dismissed'; state: ReportState;
  decision: string | null; created_at: string; decided_at: string | null; resolution_note: string | null;
  assigned_to: string | null; assigned_at: string | null; assigned_email: string | null; resolved_by_email: string | null;
  reporter_id: string; reporter_name: string | null; target_profile_id: string | null; target_name: string | null;
  target_country: string | null; target_status: AccountStatus; target_reports: number;
  target_message_id: string | null; message_snapshot: string | null; message_body: string | null;
  message_photo_path: string | null; message_deleted_at: string | null; message_sender_id: string | null; appeals_open: number;
};
export type ReportOutcome = 'dismissed' | 'actioned' | 'warning' | 'suspension' | 'ban';

export type AppealRow = {
  id: string; details: string; status: 'open' | 'accepted' | 'rejected'; created_at: string; decision_reason: string | null;
  decided_at: string | null; decided_by_email: string | null; user_id: string; user_name: string | null; user_email: string;
  user_status: AccountStatus; user_suspended_until: string | null; role: 'target' | 'reporter'; active_sanctions: number;
  report: { id: string; reason: string; details: string | null; status: string; decision: string | null; resolution_note: string | null;
    message_snapshot: string | null; created_at: string; decided_at: string | null };
};

export type VerificationRow = {
  id: string; user_id: string; storage_path: string; status: 'pending' | 'approved' | 'rejected'; created_at: string;
  decision_reason: string | null; decided_at: string | null; name: string | null; age: number | null; country: string | null;
  city: string | null; verification_status: Verification; previous_requests: number; photos: string[];
};

export type AuditRow = {
  id: number; created_at: string; action: string; admin_id: string | null; admin_email: string | null;
  target_user: string | null; target_name: string | null; target_email: string | null; target_id: string | null;
  reason: string | null; details: Record<string, unknown>;
};
export type AdminRow = { user_id: string; email: string; name: string | null; created_at: string; added_by_email: string | null; is_me: boolean };

export const adminApi = {
  dashboard: () => call<Dashboard>('admin_dashboard'),

  users: (f: UserFilter) => call<Page<UserRow>>('admin_user_search', {
    p_query: f.query?.trim() || null, p_country: f.country ?? null, p_status: f.status ?? null,
    p_verification: f.verification ?? null, p_demo: f.demo ?? null, p_sort: f.sort ?? 'new', p_limit: f.limit, p_offset: f.offset,
  }),
  user: (id: string) => call<UserDetail>('admin_user_detail', { p_user: id }),
  sanction: (user: string, kind: 'warning' | 'suspension' | 'ban', reason: string, days?: number) =>
    call<{ sanction_id: string; suspended_until: string | null }>('admin_sanction_user', { p_user: user, p_kind: kind, p_reason: reason, p_days: days ?? null }),
  lift: (user: string, reason: string, sanctionId?: string) =>
    call<{ lifted: number; suspended_until: string | null }>('admin_lift_sanction', { p_user: user, p_reason: reason, p_sanction: sanctionId ?? null }),
  verify: (user: string, decision: 'approved' | 'rejected' | 'revoked', reason?: string) =>
    call<void>('admin_verification_decide', { p_user: user, p_decision: decision, p_reason: reason ?? null }),
  resetFree: (user: string, reason: string) => call<void>('admin_reset_free', { p_user: user, p_reason: reason }),
  removePhoto: (photo: string, reason: string) => call<void>('admin_remove_photo', { p_photo: photo, p_reason: reason }),

  reports: (f: { state: ReportState | null; reason?: string | null; country?: string | null; assigned?: 'me' | 'none' | null; target?: string | null; limit: number; offset: number }) =>
    call<Page<ReportRow>>('admin_report_queue', {
      p_state: f.state, p_reason: f.reason ?? null, p_country: f.country ?? null, p_assigned: f.assigned ?? null,
      p_target: f.target ?? null, p_limit: f.limit, p_offset: f.offset,
    }),
  assignReport: (id: string, assign: boolean) => call<void>('admin_report_assign', { p_report: id, p_assign: assign }),
  resolveReport: (id: string, outcome: ReportOutcome, note: string, days?: number, removeMessage?: boolean) =>
    call<{ sanction_id: string | null }>('admin_report_resolve', {
      p_report: id, p_outcome: outcome, p_note: note, p_days: days ?? null, p_remove_message: !!removeMessage,
    }),

  appeals: (status: 'open' | 'accepted' | 'rejected' | null, limit: number, offset: number) =>
    call<Page<AppealRow>>('admin_appeal_queue', { p_status: status, p_limit: limit, p_offset: offset }),
  decideAppeal: (id: string, accept: boolean, reason: string) =>
    call<{ lifted: number; suspended_until: string | null; report_reopened: boolean }>('admin_appeal_decide', { p_appeal: id, p_accept: accept, p_reason: reason }),

  verifications: (status: 'pending' | 'approved' | 'rejected' | null, limit: number, offset: number) =>
    call<Page<VerificationRow>>('admin_verification_queue', { p_status: status, p_limit: limit, p_offset: offset }),

  config: async (): Promise<Record<string, unknown>> => {
    const { data, error } = await supabase.from('app_config').select('key, value');
    if (error) throw new AdminError(error.message, error.code);
    const m: Record<string, unknown> = {};
    for (const r of (data ?? []) as { key: string; value: unknown }[]) m[r.key] = r.value;
    return m;
  },
  setConfig: (key: string, value: unknown, reason?: string) =>
    call<unknown>('admin_config_set', { p_key: key, p_value: value, p_reason: reason ?? null }),

  audit: (f: { action?: string | null; admin?: string | null; target?: string | null; limit: number; offset: number }) =>
    call<Page<AuditRow>>('admin_audit_log', { p_action: f.action ?? null, p_admin: f.admin ?? null, p_target: f.target ?? null, p_limit: f.limit, p_offset: f.offset }),

  admins: () => call<AdminRow[]>('admin_list_admins'),
  addAdmin: (email: string, reason: string) => call<string>('admin_add_admin', { p_email: email, p_reason: reason }),
  removeAdmin: (user: string, reason: string) => call<void>('admin_remove_admin', { p_user: user, p_reason: reason }),
};

// Client-side mirrors of the server validation (the server is authoritative).
export const isHttpsUrl = (v: string) => /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]+)?(\/\S*)?$/.test(v.trim());
export const isEmail = (v: string) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v.trim());
