'use client';

import { useCallback, useRef, useState } from 'react';

export type SortDir = 'asc' | 'desc';

/**
 * Shared filter/sort state for admin lists.
 * A double click on the filter or sort button resets it (spec: двойное нажатие отменяет).
 */
export function useAdminListControls<F extends string, S extends string>(defaults: {
  filter: F;
  sort: S;
  dir?: SortDir;
}) {
  const [filter, setFilter] = useState<F>(defaults.filter);
  const [sort, setSort] = useState<S>(defaults.sort);
  const [dir, setDir] = useState<SortDir>(defaults.dir ?? 'desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const lastClick = useRef<{ kind: 'filter' | 'sort'; at: number } | null>(null);

  const isDouble = (kind: 'filter' | 'sort') => {
    const now = Date.now();
    const prev = lastClick.current;
    lastClick.current = { kind, at: now };
    return Boolean(prev && prev.kind === kind && now - prev.at < 350);
  };

  const onFilterButton = useCallback(() => {
    if (isDouble('filter')) {
      setFilter(defaults.filter);
      setFilterOpen(false);
      return;
    }
    setSortOpen(false);
    setFilterOpen((v) => !v);
  }, [defaults.filter]);

  const onSortButton = useCallback(() => {
    if (isDouble('sort')) {
      setSort(defaults.sort);
      setDir(defaults.dir ?? 'desc');
      setSortOpen(false);
      return;
    }
    setFilterOpen(false);
    setSortOpen((v) => !v);
  }, [defaults.sort, defaults.dir]);

  const chooseSort = useCallback(
    (next: S) => {
      if (next === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSort(next);
        setDir('desc');
      }
    },
    [sort],
  );

  return {
    filter,
    setFilter,
    sort,
    setSort: chooseSort,
    dir,
    setDir,
    filterOpen,
    setFilterOpen,
    sortOpen,
    setSortOpen,
    onFilterButton,
    onSortButton,
    filterActive: filter !== defaults.filter,
    sortActive: sort !== defaults.sort || dir !== (defaults.dir ?? 'desc'),
  };
}
