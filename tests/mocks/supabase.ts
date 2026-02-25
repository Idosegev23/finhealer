/**
 * Mock Supabase client for E2E tests.
 * Provides a chainable query builder that records operations
 * and returns configurable data.
 */

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface MockRow {
  [key: string]: any;
}

interface MockQueryResult {
  data: MockRow[] | MockRow | null;
  error: null | { message: string };
  count?: number;
}

interface TableStore {
  [tableName: string]: MockRow[];
}

// ============================================================================
// MockQueryBuilder - chainable Supabase-like query builder
// ============================================================================

class MockQueryBuilder {
  private tableName: string;
  private store: TableStore;
  private filters: Array<{ column: string; op: string; value: any }> = [];
  private selectColumns: string = '*';
  private orderColumn: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;
  private isHead: boolean = false;
  private isCount: boolean = false;
  private updateData: MockRow | null = null;
  private insertData: MockRow | MockRow[] | null = null;
  private inFilter: { column: string; values: any[] } | null = null;

  constructor(tableName: string, store: TableStore) {
    this.tableName = tableName;
    this.store = store;
    if (!this.store[tableName]) {
      this.store[tableName] = [];
    }
  }

  select(columns: string = '*', opts?: { count?: string; head?: boolean }): this {
    this.selectColumns = columns;
    if (opts?.count === 'exact') this.isCount = true;
    if (opts?.head) this.isHead = true;
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: any): this {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gte(column: string, value: any): this {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lte(column: string, value: any): this {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.inFilter = { column, values };
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): MockQueryResult {
    this.isSingle = true;
    return this._execute();
  }

  update(data: MockRow): this {
    this.updateData = data;
    return this;
  }

  insert(data: MockRow | MockRow[]): this {
    this.insertData = data;
    return this;
  }

  delete(): this {
    // Mark as delete operation
    this.updateData = { __delete: true };
    return this;
  }

  // Terminal method - execute the query
  then(resolve: (result: MockQueryResult) => void): void {
    resolve(this._execute());
  }

  // Allow awaiting the builder directly
  private _execute(): MockQueryResult {
    const rows = this.store[this.tableName] || [];

    // INSERT
    if (this.insertData) {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      for (const item of items) {
        this.store[this.tableName].push({ ...item, id: item.id || `mock-${Date.now()}-${Math.random()}` });
      }
      return { data: items, error: null };
    }

    // Apply filters
    let filtered = [...rows];

    for (const f of this.filters) {
      filtered = filtered.filter(row => {
        if (f.op === 'eq') return row[f.column] === f.value;
        if (f.op === 'neq') return row[f.column] !== f.value;
        if (f.op === 'gte') return row[f.column] >= f.value;
        if (f.op === 'lte') return row[f.column] <= f.value;
        return true;
      });
    }

    if (this.inFilter) {
      filtered = filtered.filter(row => this.inFilter!.values.includes(row[this.inFilter!.column]));
    }

    // UPDATE
    if (this.updateData && !this.updateData.__delete) {
      for (const row of filtered) {
        Object.assign(row, this.updateData);
      }
      return { data: filtered, error: null, count: filtered.length };
    }

    // DELETE
    if (this.updateData?.__delete) {
      const ids = new Set(filtered.map(r => r.id));
      this.store[this.tableName] = rows.filter(r => !ids.has(r.id));
      return { data: null, error: null, count: filtered.length };
    }

    // ORDER
    if (this.orderColumn) {
      const col = this.orderColumn;
      const asc = this.orderAsc;
      filtered.sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
    }

    // LIMIT
    if (this.limitCount !== null) {
      filtered = filtered.slice(0, this.limitCount);
    }

    // COUNT + HEAD
    if (this.isCount && this.isHead) {
      return { data: null, error: null, count: filtered.length };
    }

    // SINGLE
    if (this.isSingle) {
      return { data: filtered[0] || null, error: filtered.length === 0 ? null : null };
    }

    return { data: filtered, error: null };
  }
}

// ============================================================================
// createMockSupabase - factory function
// ============================================================================

export function createMockSupabase(initialData?: TableStore) {
  const store: TableStore = initialData || {};

  const client = {
    from: (tableName: string) => new MockQueryBuilder(tableName, store),
    _store: store,
    _getTable: (name: string) => store[name] || [],
    _setTable: (name: string, rows: MockRow[]) => { store[name] = rows; },
    _reset: () => { Object.keys(store).forEach(k => delete store[k]); },
  };

  return client;
}

// ============================================================================
// Module mock helper - vi.mock for @/lib/supabase/server
// ============================================================================

export function setupSupabaseMock(supabase: ReturnType<typeof createMockSupabase>) {
  vi.mock('@/lib/supabase/server', () => ({
    createServiceClient: () => supabase,
    createClient: async () => supabase,
  }));
}
