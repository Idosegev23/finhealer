/**
 * Shared MockQuery for Supabase-like chainable query builder.
 * Supports thenable pattern so `await query.update({}).eq()` works.
 */

export type MockStore = Record<string, any[]>;

export class MockQuery {
  private table: string;
  private store: MockStore;
  private filters: Array<(row: any) => boolean> = [];
  private _orderCol: string | null = null;
  private _orderAsc = true;
  private _limit: number | null = null;
  private _isSingle = false;
  private _isCount = false;
  private _isHead = false;
  private _updateData: any = null;
  private _insertData: any = null;
  private _deleteOp = false;
  private _inFilter: { col: string; vals: any[] } | null = null;

  constructor(table: string, store: MockStore) {
    this.table = table;
    this.store = store;
    if (!this.store[table]) this.store[table] = [];
  }

  select(cols: string = '*', opts?: any) {
    if (opts?.count) this._isCount = true;
    if (opts?.head) this._isHead = true;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push(row => row[col] === val);
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push(row => row[col] !== val);
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push(row => row[col] >= val);
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push(row => row[col] <= val);
    return this;
  }

  in(col: string, vals: any[]) {
    this._inFilter = { col, vals };
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  single() {
    this._isSingle = true;
    return this._exec();
  }

  update(data: any) {
    this._updateData = data;
    return this;
  }

  insert(data: any) {
    this._insertData = data;
    // insert is terminal - execute immediately but still return thenable
    return this;
  }

  delete() {
    this._deleteOp = true;
    return this;
  }

  // ── Thenable: allows `await query.update({}).eq()` ──
  then(resolve?: (val: any) => void, reject?: (err: any) => void) {
    try {
      const result = this._exec();
      resolve?.(result);
    } catch (err) {
      reject?.(err);
    }
  }

  private _exec() {
    const rows = this.store[this.table] || [];

    // INSERT
    if (this._insertData) {
      const items = Array.isArray(this._insertData) ? this._insertData : [this._insertData];
      for (const item of items) {
        this.store[this.table].push({ ...item, id: item.id || `auto-${Date.now()}-${Math.random()}` });
      }
      return { data: items, error: null };
    }

    // Apply filters
    let filtered = [...rows];
    for (const f of this.filters) {
      filtered = filtered.filter(f);
    }
    if (this._inFilter) {
      const { col, vals } = this._inFilter;
      filtered = filtered.filter(row => vals.includes(row[col]));
    }

    // UPDATE
    if (this._updateData) {
      for (const row of filtered) {
        Object.assign(row, this._updateData);
      }
      return { data: filtered, error: null, count: filtered.length };
    }

    // DELETE
    if (this._deleteOp) {
      const ids = new Set(filtered.map(r => r.id));
      this.store[this.table] = rows.filter(r => !ids.has(r.id));
      return { data: null, error: null, count: filtered.length };
    }

    // ORDER
    if (this._orderCol) {
      const c = this._orderCol;
      const asc = this._orderAsc;
      filtered.sort((a, b) => {
        if (a[c] < b[c]) return asc ? -1 : 1;
        if (a[c] > b[c]) return asc ? 1 : -1;
        return 0;
      });
    }

    // LIMIT
    if (this._limit !== null) {
      filtered = filtered.slice(0, this._limit);
    }

    // COUNT + HEAD
    if (this._isCount && this._isHead) {
      return { data: null, error: null, count: filtered.length };
    }

    // SINGLE
    if (this._isSingle) {
      return { data: filtered[0] || null, error: null };
    }

    return { data: filtered, error: null };
  }
}

/**
 * Create a mock `from()` function bound to a shared store.
 */
export function createMockFrom(store: MockStore) {
  return (tableName: string) => new MockQuery(tableName, store);
}
