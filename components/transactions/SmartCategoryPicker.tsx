'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Sparkles, Tag } from 'lucide-react';
import { CATEGORIES, SUPER_GROUPS, findTopMatches } from '@/lib/finance/categories';
import type { CategoryDef } from '@/lib/finance/categories';

interface SmartCategoryPickerProps {
  value: string;
  vendor?: string;
  onChange: (category: string, expenseType?: string) => void;
}

export default function SmartCategoryPicker({ value, vendor, onChange }: SmartCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Smart suggestions based on vendor name
  const suggestions = useMemo(() => {
    if (!vendor) return [];
    return findTopMatches(vendor, 5);
  }, [vendor]);

  // Filtered categories based on search
  const filtered = useMemo(() => {
    if (!search || search.length < 2) return [];
    return findTopMatches(search, 10);
  }, [search]);

  // Group categories for browsing
  const groupedCategories = useMemo(() => {
    const groups: Record<string, CategoryDef[]> = {};
    CATEGORIES.forEach(cat => {
      if (!groups[cat.group]) groups[cat.group] = [];
      groups[cat.group].push(cat);
    });
    return groups;
  }, []);

  // Super-group order
  const superGroupOrder = Object.entries(SUPER_GROUPS);

  function selectCategory(cat: CategoryDef) {
    onChange(cat.name, cat.type);
    setOpen(false);
    setSearch('');
  }

  function selectRaw(name: string) {
    onChange(name);
    setOpen(false);
    setSearch('');
  }

  const typeLabel = (t: string) => {
    if (t === 'fixed') return 'קבוע';
    if (t === 'variable') return 'משתנה';
    return 'מיוחד';
  };

  const typeColor = (t: string) => {
    if (t === 'fixed') return 'bg-blue-100 text-blue-700';
    if (t === 'variable') return 'bg-green-100 text-green-700';
    return 'bg-orange-100 text-orange-700';
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="w-full flex items-center gap-1 px-2 py-1 text-sm border rounded hover:border-[#3A7BD5] focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none text-right bg-white"
      >
        <span className="flex-1 truncate">{value || 'בחר קטגוריה...'}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 w-72 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col" style={{ minWidth: '280px' }}>
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חפש קטגוריה..."
                className="w-full pr-8 pl-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-[#3A7BD5] focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* AI Suggestions */}
            {suggestions.length > 0 && !search && (
              <div className="p-2 border-b border-gray-100">
                <div className="flex items-center gap-1 text-xs font-semibold text-purple-600 mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>הצעות חכמות עבור &quot;{vendor}&quot;</span>
                </div>
                {suggestions.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-purple-50 rounded text-right"
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeColor(cat.type)}`}>
                      {typeLabel(cat.type)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search results */}
            {search && search.length >= 2 && (
              <div className="p-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-xs text-gray-500 mb-2">לא נמצאו תוצאות</p>
                    <button
                      onClick={() => selectRaw(search)}
                      className="text-xs text-phi-dark hover:underline"
                    >
                      השתמש ב-&quot;{search}&quot; כקטגוריה חופשית
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-gray-500 mb-1">{filtered.length} תוצאות</div>
                    {filtered.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => selectCategory(cat)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-blue-50 rounded text-right"
                      >
                        <div className="flex flex-col items-start">
                          <span className="truncate">{cat.name}</span>
                          <span className="text-[10px] text-gray-400">{cat.group}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${typeColor(cat.type)}`}>
                          {typeLabel(cat.type)}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Browse by super-group */}
            {!search && (
              <div className="p-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-1">
                  <Tag className="w-3 h-3" />
                  <span>כל הקטגוריות</span>
                </div>
                {superGroupOrder.map(([superGroup, groupNames]) => {
                  const cats = groupNames.flatMap(g => groupedCategories[g] || []);
                  if (cats.length === 0) return null;
                  return (
                    <SuperGroupSection
                      key={superGroup}
                      name={superGroup}
                      categories={cats}
                      onSelect={selectCategory}
                      typeColor={typeColor}
                      typeLabel={typeLabel}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuperGroupSection({
  name,
  categories,
  onSelect,
  typeColor,
  typeLabel,
}: {
  name: string;
  categories: CategoryDef[];
  onSelect: (cat: CategoryDef) => void;
  typeColor: (t: string) => string;
  typeLabel: (t: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded"
      >
        <span>{name} ({categories.length})</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mr-2 border-r border-gray-100 pr-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat)}
              className="w-full flex items-center justify-between px-2 py-1 text-sm hover:bg-blue-50 rounded text-right"
            >
              <span className="truncate text-xs">{cat.name}</span>
              <span className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${typeColor(cat.type)}`}>
                {typeLabel(cat.type)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
