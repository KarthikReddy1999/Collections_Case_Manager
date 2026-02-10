import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

const DEFAULT_FILTERS = {
  status: '',
  stage: '',
  dpdMin: '',
  dpdMax: '',
  assignedTo: '',
};

export default function CasesPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [result, setResult] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    for (const [key, value] of Object.entries(appliedFilters)) {
      if (value) {
        params.set(key, value);
      }
    }

    return params.toString();
  }, [appliedFilters, page, pageSize]);

  async function fetchCases() {
    setLoading(true);
    setError('');

    try {
      const [casesResponse, kpiResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/cases?${queryString}`),
        fetch(`${API_BASE_URL}/cases/kpis`),
      ]);

      const casesJson = await casesResponse.json();
      const kpiJson = await kpiResponse.json();

      if (!casesResponse.ok) {
        throw new Error(casesJson?.error?.message || 'Failed to load cases');
      }

      if (!kpiResponse.ok) {
        throw new Error(kpiJson?.error?.message || 'Failed to load KPI metrics');
      }

      setResult(casesJson);
      setKpis(kpiJson);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  useEffect(() => {
    fetchCases();
  }, [queryString]);

  return (
    <main className="page">
      <header className="header">
        <h1>Collections Case Manager</h1>
        <p>Track delinquency cases, assignments, and actions.</p>
      </header>

      <section className="card filters">
        <div className="row">
          <label>Status</label>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <div className="row">
          <label>Stage</label>
          <select value={filters.stage} onChange={(event) => updateFilter('stage', event.target.value)}>
            <option value="">All</option>
            <option value="SOFT">SOFT</option>
            <option value="HARD">HARD</option>
            <option value="LEGAL">LEGAL</option>
          </select>
        </div>

        <div className="row">
          <label>DPD Min</label>
          <input
            value={filters.dpdMin}
            type="number"
            onChange={(event) => updateFilter('dpdMin', event.target.value)}
          />
        </div>

        <div className="row">
          <label>DPD Max</label>
          <input
            value={filters.dpdMax}
            type="number"
            onChange={(event) => updateFilter('dpdMax', event.target.value)}
          />
        </div>

        <div className="row">
          <label>Assigned To</label>
          <input
            value={filters.assignedTo}
            onChange={(event) => updateFilter('assignedTo', event.target.value)}
            placeholder="Tier1 / SeniorAgent"
          />
        </div>

        <button
          className="primary"
          onClick={() => {
            setPage(1);
            setAppliedFilters(filters);
          }}
        >
          Apply Filters
        </button>
      </section>

      <section className="kpi-grid">
        <article className="card kpi">
          <h2>Open Cases</h2>
          <div className="kpi-value">{kpis ? kpis.openCasesCount : '-'}</div>
        </article>
        <article className="card kpi">
          <h2>Resolved Today</h2>
          <div className="kpi-value">{kpis ? kpis.resolvedTodayCount : '-'}</div>
        </article>
        <article className="card kpi">
          <h2>Avg Open DPD</h2>
          <div className="kpi-value">{kpis ? kpis.averageDpdOpenCases : '-'}</div>
        </article>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        {loading && <p>Loading...</p>}
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>DPD</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Updated</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {result?.data?.length ? (
              result.data.map((caseItem) => (
                <tr key={caseItem.id}>
                  <td>{caseItem.id}</td>
                  <td>{caseItem.customer.name}</td>
                  <td>{caseItem.dpd}</td>
                  <td>{caseItem.stage}</td>
                  <td>{caseItem.status}</td>
                  <td>{caseItem.assignedTo || 'Unassigned'}</td>
                  <td>{new Date(caseItem.updatedAt).toLocaleString()}</td>
                  <td>
                    <Link href={`/cases/${caseItem.id}`}>Open</Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>{loading ? 'Loading...' : 'No cases found'}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button disabled={page <= 1} onClick={() => { setPage((p) => p - 1); }}>
            Previous
          </button>
          <span>
            Page {result?.meta?.page || page} / {result?.meta?.totalPages || 1}
          </span>
          <button
            disabled={!result?.meta || page >= result.meta.totalPages}
            onClick={() => { setPage((p) => p + 1); }}
          >
            Next
          </button>
        </div>
      </section>

      <section>
        <button className="ghost" onClick={fetchCases}>Refresh</button>
      </section>
    </main>
  );
}
