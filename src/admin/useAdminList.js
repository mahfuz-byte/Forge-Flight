import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from './adminApi';

/**
 * Server-side paginated, filtered list for admin tables (Phase 5.1).
 *
 * Page and filters live in the URL (?page=2&q=…), so views are shareable and
 * survive refreshes. Changing a filter resets to page 1.
 */
export default function useAdminList(path, { filterKeys = [], pageSize = 25 } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filterKeyString = filterKeys.join(',');
  const filters = useMemo(() => {
    const out = {};
    filterKeyString.split(',').filter(Boolean).forEach((k) => { out[k] = searchParams.get(k) || ''; });
    return out;
  }, [searchParams, filterKeyString]);
  const filterString = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi.get(path, { ...JSON.parse(filterString), page, page_size: pageSize })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => {
        if (cancelled) return;
        // Asking for a page past the end (e.g. after filtering) → back to page 1.
        if (err.kind === 'notfound' && page > 1) {
          setSearchParams((cur) => { const next = new URLSearchParams(cur); next.delete('page'); return next; }, { replace: true });
          return;
        }
        setError(err);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, page, pageSize, filterString, reloadKey, setSearchParams]);

  const setFilter = useCallback((key, value) => {
    setSearchParams((cur) => {
      const next = new URLSearchParams(cur);
      if (value) next.set(key, value); else next.delete(key);
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const setPage = useCallback((n) => {
    setSearchParams((cur) => {
      const next = new URLSearchParams(cur);
      if (n > 1) next.set('page', String(n)); else next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    rows: data?.results || [],
    count: data?.count || 0,
    page: data?.page || page,
    totalPages: data?.total_pages || 1,
    loading,
    error,
    filters,
    setFilter,
    setPage,
    reload,
  };
}
