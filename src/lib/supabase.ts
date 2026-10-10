import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured =
  Boolean(envUrl) &&
  Boolean(envKey) &&
  envUrl.startsWith('http') &&
  !envUrl.includes('your-project-id.supabase.co') &&
  envKey !== 'your-supabase-anon-key';

// ============================================================================
// Local Stateful Supabase-Compatible Client (Used ONLY when VITE_SUPABASE_URL
// is not yet configured in the preview environment so all features work live)
// ============================================================================

interface LocalUserRecord {
  id: string;
  email: string;
  password: string;
  user_metadata: { phone?: string };
}

type RealtimeCallback = (payload: any) => void;
const realtimeListeners = new Set<RealtimeCallback>();

function notifyRealtime(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow?: any, oldRow?: any) {
  realtimeListeners.forEach((cb) => {
    try {
      cb({ table, eventType, new: newRow, old: oldRow });
    } catch {
      // ignore listener errors
    }
  });
}

function getLocalStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function ensureSeedDataForUser(userId: string) {
  const seededKey = `sms_seeded_${userId}`;
  if (localStorage.getItem(seededKey)) return;

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };

  const customers = getLocalStore<any[]>('sms_table_customers', []);
  const seedCustomers = [
    { id: crypto.randomUUID(), user_id: userId, name: 'Axmed Maxamed Cali', phone: '+252615234891', balance: 145.0, created_at: iso(daysAgo(6)) },
    { id: crypto.randomUUID(), user_id: userId, name: 'Fartuun Cabdullaahi Xasan', phone: '+252618902314', balance: 82.5, created_at: iso(daysAgo(5)) },
    { id: crypto.randomUUID(), user_id: userId, name: 'Cabdiraxmaan Yuusuf Warsame', phone: '+252612445780', balance: 310.0, created_at: iso(daysAgo(4)) },
    { id: crypto.randomUUID(), user_id: userId, name: 'Xaliimo Nuur Shire', phone: '+252617331092', balance: 0, created_at: iso(daysAgo(3)) },
    { id: crypto.randomUUID(), user_id: userId, name: 'Maxamuud Cali Geedi', phone: '+252615998123', balance: 64.0, created_at: iso(daysAgo(2)) },
    { id: crypto.randomUUID(), user_id: userId, name: 'Aamina Xuseen Faarax', phone: '+252616114509', balance: 190.0, created_at: iso(daysAgo(1)) },
  ];
  setLocalStore('sms_table_customers', [...customers, ...seedCustomers]);

  const templates = getLocalStore<any[]>('sms_table_templates', []);
  const seedTemplates = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Xasuusin Deyn Caadi ah',
      body: 'Salaan {name}, waxaa kugu leeyahay {amount}. Fadlan bixi {amount} adigoo mahadsan.',
      created_at: iso(daysAgo(5)),
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Xasuusin Bisha Dhammaadkeeda',
      body: 'Asalaamu Calaykum {name}, xisaabtaada waxaa ku taagan {amount}. Fadlan ku soo dir EVC Plus lambarkan. Mahadsanid.',
      created_at: iso(daysAgo(3)),
    },
  ];
  setLocalStore('sms_table_templates', [...templates, ...seedTemplates]);

  const camp1Id = crypto.randomUUID();
  const camp2Id = crypto.randomUUID();
  const campaigns = getLocalStore<any[]>('sms_table_campaigns', []);
  const seedCampaigns = [
    {
      id: camp1Id,
      user_id: userId,
      title: 'Xasuusin Deyn - Todobaadkii Hore',
      template_body: 'Salaan {name}, waxaa kugu leeyahay {amount}. Fadlan bixi {amount} adigoo mahadsan.',
      total: 4,
      status: 'completed',
      created_at: iso(daysAgo(2)),
    },
    {
      id: camp2Id,
      user_id: userId,
      title: 'Baaqa Macaamiisha Maanta',
      template_body: 'Salaan {name}, waxaa kugu leeyahay {amount}. Fadlan bixi {amount} adigoo mahadsan. - {company}',
      total: 5,
      status: 'queued',
      created_at: iso(now),
    },
  ];
  setLocalStore('sms_table_campaigns', [...campaigns, ...seedCampaigns]);

  const outbox = getLocalStore<any[]>('sms_table_outbox', []);
  const seedOutbox = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp1Id,
      customer_id: seedCustomers[0].id,
      phone: seedCustomers[0].phone,
      message: `Salaan ${seedCustomers[0].name}, waxaa kugu leeyahay $145.00. Fadlan bixi $145.00 adigoo mahadsan.`,
      status: 'delivered',
      error: null,
      attempts: 1,
      created_at: iso(daysAgo(2)),
      sent_at: iso(daysAgo(2)),
      delivered_at: iso(daysAgo(2)),
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp1Id,
      customer_id: seedCustomers[1].id,
      phone: seedCustomers[1].phone,
      message: `Salaan ${seedCustomers[1].name}, waxaa kugu leeyahay $82.50. Fadlan bixi $82.50 adigoo mahadsan.`,
      status: 'delivered',
      error: null,
      attempts: 1,
      created_at: iso(daysAgo(2)),
      sent_at: iso(daysAgo(2)),
      delivered_at: iso(daysAgo(2)),
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp1Id,
      customer_id: seedCustomers[2].id,
      phone: seedCustomers[2].phone,
      message: `Salaan ${seedCustomers[2].name}, waxaa kugu leeyahay $310.00. Fadlan bixi $310.00 adigoo mahadsan.`,
      status: 'delivered',
      error: null,
      attempts: 1,
      created_at: iso(daysAgo(1)),
      sent_at: iso(daysAgo(1)),
      delivered_at: iso(daysAgo(1)),
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp1Id,
      customer_id: seedCustomers[4].id,
      phone: seedCustomers[4].phone,
      message: `Salaan ${seedCustomers[4].name}, waxaa kugu leeyahay $64.00. Fadlan bixi $64.00 adigoo mahadsan.`,
      status: 'sent',
      error: null,
      attempts: 1,
      created_at: iso(daysAgo(1)),
      sent_at: iso(daysAgo(1)),
      delivered_at: null,
    },
    // Today's campaign
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp2Id,
      customer_id: seedCustomers[0].id,
      phone: seedCustomers[0].phone,
      message: `Salaan ${seedCustomers[0].name}, waxaa kugu leeyahay $145.00. Fadlan bixi $145.00 adigoo mahadsan.`,
      status: 'delivered',
      error: null,
      attempts: 1,
      created_at: iso(now),
      sent_at: iso(now),
      delivered_at: iso(now),
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp2Id,
      customer_id: seedCustomers[1].id,
      phone: seedCustomers[1].phone,
      message: `Salaan ${seedCustomers[1].name}, waxaa kugu leeyahay $82.50. Fadlan bixi $82.50 adigoo mahadsan.`,
      status: 'sent',
      error: null,
      attempts: 1,
      created_at: iso(now),
      sent_at: iso(now),
      delivered_at: null,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp2Id,
      customer_id: seedCustomers[2].id,
      phone: seedCustomers[2].phone,
      message: `Salaan ${seedCustomers[2].name}, waxaa kugu leeyahay $310.00. Fadlan bixi $310.00 adigoo mahadsan.`,
      status: 'pending',
      error: null,
      attempts: 0,
      created_at: iso(now),
      sent_at: null,
      delivered_at: null,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp2Id,
      customer_id: seedCustomers[4].id,
      phone: seedCustomers[4].phone,
      message: `Salaan ${seedCustomers[4].name}, waxaa kugu leeyahay $64.00. Fadlan bixi $64.00 adigoo mahadsan.`,
      status: 'pending',
      error: null,
      attempts: 0,
      created_at: iso(now),
      sent_at: null,
      delivered_at: null,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      campaign_id: camp2Id,
      customer_id: seedCustomers[5].id,
      phone: seedCustomers[5].phone,
      message: `Salaan ${seedCustomers[5].name}, waxaa kugu leeyahay $190.00. Fadlan bixi $190.00 adigoo mahadsan.`,
      status: 'failed',
      error: 'No SMS credit / SIM timeout',
      attempts: 2,
      created_at: iso(now),
      sent_at: null,
      delivered_at: null,
    },
  ];
  setLocalStore('sms_table_outbox', [...outbox, ...seedOutbox]);

  const gateways = getLocalStore<any[]>('sms_table_gateway', []);
  const seedGateway = {
    user_id: userId,
    is_enabled: true,
    min_delay_ms: 3000,
    max_delay_ms: 7000,
    daily_limit: 350,
    last_seen: new Date().toISOString(),
    battery: 88,
    company_name: 'Dukaanka Guuleed',
  };
  setLocalStore('sms_table_gateway', [...gateways.filter((g) => g.user_id !== userId), seedGateway]);

  localStorage.setItem(seededKey, 'true');
}

function createLocalSupabaseClient(): SupabaseClient {
  const SESSION_KEY = 'sms_local_session';
  const USERS_KEY = 'sms_local_users';
  const authListeners = new Set<(event: string, session: any) => void>();

  // Create a default demo user so the user can either create an account or log in right away
  const existingUsers = getLocalStore<LocalUserRecord[]>(USERS_KEY, []);
  if (existingUsers.length === 0) {
    const defaultUser: LocalUserRecord = {
      id: 'demo-user-somalia-001',
      email: '252615000000@smsapp.local',
      password: 'password123',
      user_metadata: { phone: '+252615000000' },
    };
    setLocalStore(USERS_KEY, [defaultUser]);
    ensureSeedDataForUser(defaultUser.id);
  }

  const getCurrentUserId = (): string | null => {
    const sess = getLocalStore<any>(SESSION_KEY, null);
    return sess?.user?.id || null;
  };

  class LocalQueryBuilder {
    private table: string;
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    private payload: any = null;
    private upsertOpts: any = null;
    private filters: Array<(row: any) => boolean> = [];
    private sortColumn: string | null = null;
    private sortAsc: boolean = true;
    private returnSingle: 'none' | 'single' | 'maybeSingle' = 'none';

    constructor(table: string) {
      this.table = table;
    }

    select(_columns = '*') {
      if (this.op === 'select') {
        this.op = 'select';
      }
      return this;
    }

    insert(values: any) {
      this.op = 'insert';
      this.payload = Array.isArray(values) ? values : [values];
      return this;
    }

    update(values: any) {
      this.op = 'update';
      this.payload = values;
      return this;
    }

    upsert(values: any, opts?: any) {
      this.op = 'upsert';
      this.payload = Array.isArray(values) ? values : [values];
      this.upsertOpts = opts;
      return this;
    }

    delete() {
      this.op = 'delete';
      return this;
    }

    eq(column: string, value: any) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    gt(column: string, value: any) {
      this.filters.push((row) => Number(row[column]) > Number(value));
      return this;
    }

    in(column: string, values: any[]) {
      const set = new Set(values);
      this.filters.push((row) => set.has(row[column]));
      return this;
    }

    order(column: string, opts?: { ascending?: boolean }) {
      this.sortColumn = column;
      this.sortAsc = opts?.ascending !== undefined ? opts.ascending : true;
      return this;
    }

    single() {
      this.returnSingle = 'single';
      return this;
    }

    maybeSingle() {
      this.returnSingle = 'maybeSingle';
      return this;
    }

    private execute(): { data: any; error: any } {
      const userId = getCurrentUserId();
      if (!userId) {
        return { data: null, error: { message: 'Not authenticated' } };
      }

      const storeKey = `sms_table_${this.table}`;
      let rows = getLocalStore<any[]>(storeKey, []);

      // Enforce RLS per user_id
      const matchesFilters = (r: any) =>
        r.user_id === userId && this.filters.every((fn) => fn(r));

      if (this.op === 'select') {
        let result = rows.filter(matchesFilters);
        if (this.sortColumn) {
          const col = this.sortColumn;
          const dir = this.sortAsc ? 1 : -1;
          result = [...result].sort((a, b) => {
            if (a[col] < b[col]) return -1 * dir;
            if (a[col] > b[col]) return 1 * dir;
            return 0;
          });
        }
        if (this.returnSingle === 'single') {
          if (result.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
          }
          return { data: result[0], error: null };
        }
        if (this.returnSingle === 'maybeSingle') {
          return { data: result[0] || null, error: null };
        }
        return { data: result, error: null };
      }

      if (this.op === 'insert') {
        const now = new Date().toISOString();
        const inserted = (this.payload as any[]).map((item) => ({
          id: this.table === 'gateway' ? undefined : item.id || crypto.randomUUID(),
          created_at: item.created_at || now,
          attempts: this.table === 'outbox' ? (item.attempts ?? 0) : undefined,
          error: this.table === 'outbox' ? (item.error ?? null) : undefined,
          sent_at: this.table === 'outbox' ? (item.sent_at ?? null) : undefined,
          delivered_at: this.table === 'outbox' ? (item.delivered_at ?? null) : undefined,
          ...item,
          user_id: userId, // Simulated DB default auth.uid()
        }));
        rows = [...rows, ...inserted];
        setLocalStore(storeKey, rows);
        inserted.forEach((r) => notifyRealtime(this.table, 'INSERT', r));
        if (this.returnSingle !== 'none') {
          return { data: inserted[0] || null, error: null };
        }
        return { data: inserted, error: null };
      }

      if (this.op === 'update') {
        const updated: any[] = [];
        rows = rows.map((r) => {
          if (matchesFilters(r)) {
            const next = { ...r, ...this.payload };
            updated.push(next);
            notifyRealtime(this.table, 'UPDATE', next, r);
            return next;
          }
          return r;
        });
        // Special case for gateway: if no row existed yet for user, create it
        if (this.table === 'gateway' && updated.length === 0 && this.filters.length === 0) {
          const next = {
            user_id: userId,
            is_enabled: true,
            min_delay_ms: 3000,
            max_delay_ms: 7000,
            daily_limit: 300,
            last_seen: new Date().toISOString(),
            battery: 88,
            ...this.payload,
          };
          rows.push(next);
          updated.push(next);
          notifyRealtime(this.table, 'INSERT', next);
        }
        setLocalStore(storeKey, rows);
        if (this.returnSingle !== 'none') {
          return { data: updated[0] || null, error: null };
        }
        return { data: updated, error: null };
      }

      if (this.op === 'upsert') {
        const now = new Date().toISOString();
        const upserted: any[] = [];
        const conflictCol =
          this.table === 'gateway'
            ? 'user_id'
            : this.upsertOpts?.onConflict?.includes('phone')
            ? 'phone'
            : 'id';

        for (const item of this.payload as any[]) {
          const existingIdx = rows.findIndex(
            (r) =>
              r.user_id === userId &&
              (conflictCol === 'user_id'
                ? true
                : conflictCol === 'phone'
                ? r.phone === item.phone
                : item.id && r.id === item.id)
          );
          if (existingIdx >= 0) {
            const next = { ...rows[existingIdx], ...item, user_id: userId };
            rows[existingIdx] = next;
            upserted.push(next);
            notifyRealtime(this.table, 'UPDATE', next);
          } else {
            const next = {
              id: this.table === 'gateway' ? undefined : item.id || crypto.randomUUID(),
              created_at: now,
              ...item,
              user_id: userId,
            };
            rows.push(next);
            upserted.push(next);
            notifyRealtime(this.table, 'INSERT', next);
          }
        }
        setLocalStore(storeKey, rows);
        if (this.returnSingle !== 'none') {
          return { data: upserted[0] || null, error: null };
        }
        return { data: upserted, error: null };
      }

      if (this.op === 'delete') {
        const deleted: any[] = [];
        rows = rows.filter((r) => {
          if (matchesFilters(r)) {
            deleted.push(r);
            notifyRealtime(this.table, 'DELETE', undefined, r);
            return false;
          }
          return true;
        });
        setLocalStore(storeKey, rows);
        return { data: deleted, error: null };
      }

      return { data: null, error: null };
    }

    then<TResult1 = { data: any; error: any }, TResult2 = never>(
      onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
    }
  }

  const client: any = {
    auth: {
      async getSession() {
        const session = getLocalStore<any>(SESSION_KEY, null);
        return { data: { session }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: any) => void) {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        };
      },
      async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
        const users = getLocalStore<LocalUserRecord[]>(USERS_KEY, []);
        const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (exists) {
          return {
            data: { user: null, session: null },
            error: { message: 'User already registered', status: 400 },
          };
        }
        const newUser: LocalUserRecord = {
          id: crypto.randomUUID(),
          email,
          password,
          user_metadata: options?.data || {},
        };
        users.push(newUser);
        setLocalStore(USERS_KEY, users);
        ensureSeedDataForUser(newUser.id);

        const session = {
          access_token: `local-token-${newUser.id}`,
          user: {
            id: newUser.id,
            email: newUser.email,
            user_metadata: newUser.user_metadata,
          },
        };
        setLocalStore(SESSION_KEY, session);
        authListeners.forEach((cb) => cb('SIGNED_IN', session));
        return { data: { user: session.user, session }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const users = getLocalStore<LocalUserRecord[]>(USERS_KEY, []);
        const found = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );
        if (!found) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials', status: 400 },
          };
        }
        ensureSeedDataForUser(found.id);
        const session = {
          access_token: `local-token-${found.id}`,
          user: {
            id: found.id,
            email: found.email,
            user_metadata: found.user_metadata,
          },
        };
        setLocalStore(SESSION_KEY, session);
        authListeners.forEach((cb) => cb('SIGNED_IN', session));
        return { data: { user: session.user, session }, error: null };
      },
      async signOut() {
        localStorage.removeItem(SESSION_KEY);
        authListeners.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      },
      async updateUser({ password }: { password?: string }) {
        const session = getLocalStore<any>(SESSION_KEY, null);
        if (!session?.user) {
          return { data: { user: null }, error: { message: 'Not authenticated' } };
        }
        if (password) {
          const users = getLocalStore<LocalUserRecord[]>(USERS_KEY, []);
          const updated = users.map((u) =>
            u.id === session.user.id ? { ...u, password } : u
          );
          setLocalStore(USERS_KEY, updated);
        }
        return { data: { user: session.user }, error: null };
      },
    },
    from(table: string) {
      return new LocalQueryBuilder(table);
    },
    async rpc(fnName: string, params: any) {
      const userId = getCurrentUserId();
      if (!userId) {
        return { data: null, error: { message: 'Not authenticated' } };
      }

      // Fetch company name from gateway row for replacement in RPC
      const gateways = getLocalStore<any[]>('sms_table_gateway', []);
      const userGw = gateways.find((g) => g.user_id === userId);
      const companyName = userGw?.company_name || '';

      if (fnName === 'send_campaign') {
        const { p_title, p_template, p_customer_ids = [] } = params || {};
        const allCustomers = getLocalStore<any[]>('sms_table_customers', []);
        const idSet = new Set(p_customer_ids);
        const customers = allCustomers.filter((c) => c.user_id === userId && idSet.has(c.id));
        const campaignId = crypto.randomUUID();
        const now = new Date().toISOString();
        const newCampaign = {
          id: campaignId,
          user_id: userId,
          title: p_title,
          template_body: p_template,
          total: customers.length,
          status: 'queued',
          created_at: now,
        };
        const campaigns = getLocalStore<any[]>('sms_table_campaigns', []);
        setLocalStore('sms_table_campaigns', [...campaigns, newCampaign]);

        const outbox = getLocalStore<any[]>('sms_table_outbox', []);
        const newOutboxRows = customers.map((c) => {
          const amountFormatted = `$${Number(c.balance).toFixed(2)}`;
          const msg = String(p_template)
            .replace(/\{name\}/g, c.name)
            .replace(/\{amount\}/g, amountFormatted)
            .replace(/\{company\}/g, companyName);
          return {
            id: crypto.randomUUID(),
            user_id: userId,
            campaign_id: campaignId,
            customer_id: c.id,
            phone: c.phone,
            message: msg,
            status: 'pending',
            error: null,
            attempts: 0,
            created_at: now,
            sent_at: null,
            delivered_at: null,
          };
        });
        setLocalStore('sms_table_outbox', [...outbox, ...newOutboxRows]);
        notifyRealtime('campaigns', 'INSERT', newCampaign);
        newOutboxRows.forEach((r) => notifyRealtime('outbox', 'INSERT', r));
        return { data: campaignId, error: null };
      }

      if (fnName === 'create_campaign') {
        const { p_title, p_template, p_min_balance = 0 } = params || {};
        const customers = getLocalStore<any[]>('sms_table_customers', []).filter(
          (c) => c.user_id === userId && Number(c.balance) >= Number(p_min_balance)
        );
        const campaignId = crypto.randomUUID();
        const now = new Date().toISOString();
        const newCampaign = {
          id: campaignId,
          user_id: userId,
          title: p_title,
          template_body: p_template,
          total: customers.length,
          status: 'queued',
          created_at: now,
        };
        const campaigns = getLocalStore<any[]>('sms_table_campaigns', []);
        setLocalStore('sms_table_campaigns', [...campaigns, newCampaign]);

        const outbox = getLocalStore<any[]>('sms_table_outbox', []);
        const newOutboxRows = customers.map((c) => {
          const amountFormatted = `$${Number(c.balance).toFixed(2)}`;
          const msg = String(p_template)
            .replace(/\{name\}/g, c.name)
            .replace(/\{amount\}/g, amountFormatted)
            .replace(/\{company\}/g, companyName);
          return {
            id: crypto.randomUUID(),
            user_id: userId,
            campaign_id: campaignId,
            customer_id: c.id,
            phone: c.phone,
            message: msg,
            status: 'pending',
            error: null,
            attempts: 0,
            created_at: now,
            sent_at: null,
            delivered_at: null,
          };
        });
        setLocalStore('sms_table_outbox', [...outbox, ...newOutboxRows]);
        notifyRealtime('campaigns', 'INSERT', newCampaign);
        newOutboxRows.forEach((r) => notifyRealtime('outbox', 'INSERT', r));
        return { data: campaignId, error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${fnName}` } };
    },
    channel(_name: string) {
      const handlers: RealtimeCallback[] = [];
      const ch = {
        on(_type: string, filter: any, callback: RealtimeCallback) {
          const wrapped: RealtimeCallback = (payload) => {
            if (!filter?.table || filter.table === '*' || filter.table === payload.table) {
              callback(payload);
            }
          };
          handlers.push(wrapped);
          realtimeListeners.add(wrapped);
          return ch;
        },
        subscribe() {
          return ch;
        },
        _handlers: handlers,
      };
      return ch;
    },
    removeChannel(ch: any) {
      if (ch?._handlers) {
        ch._handlers.forEach((h: RealtimeCallback) => realtimeListeners.delete(h));
      }
      return Promise.resolve('ok');
    },
  };

  return client as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(envUrl, envKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createLocalSupabaseClient();
