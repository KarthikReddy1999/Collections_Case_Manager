import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

const DEFAULT_ACTION = {
  type: 'CALL',
  outcome: 'NO_ANSWER',
  notes: '',
};

export default function CaseDetailsPage() {
  const router = useRouter();
  const caseId = router.query.id;

  const [caseData, setCaseData] = useState(null);
  const [actionForm, setActionForm] = useState(DEFAULT_ACTION);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function fetchCase() {
    if (!caseId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/cases/${caseId}`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error?.message || 'Failed to fetch case details');
      }

      setCaseData(json);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAssignment() {
    if (!caseId) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/cases/${caseId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: caseData?.version,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error?.message || 'Failed to run assignment');
      }

      setMessage(
        `Assigned to ${json.assignedTo || 'Unassigned'} (${json.stage}) - version ${json.version}`,
      );
      await fetchCase();
    } catch (assignError) {
      setError(assignError.message);
    }
  }

  async function submitAction(event) {
    event.preventDefault();

    if (!caseId) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/cases/${caseId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionForm),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error?.message || 'Failed to add action');
      }

      setActionForm(DEFAULT_ACTION);
      setMessage('Action log added');
      await fetchCase();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function openPdf() {
    window.open(`${API_BASE_URL}/cases/${caseId}/notice.pdf`, '_blank', 'noopener,noreferrer');
  }

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  return (
    <main className="page">
      <header className="header split">
        <div>
          <h1>Case Details</h1>
          <p>Case #{caseId || '-'} assignment and recovery actions</p>
        </div>
        <div className="inline-actions">
          <Link href="/cases">Back to Cases</Link>
          <button className="ghost" onClick={fetchCase}>Refresh</button>
        </div>
      </header>

      <section className="card inline-actions">
        <button className="primary" onClick={runAssignment}>Run Assignment</button>
        <button className="primary" onClick={openPdf}>Generate PDF Notice</button>
        <button className="ghost" onClick={fetchCase}>Load Case</button>
      </section>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {loading && <p>Loading...</p>}

      {caseData && (
        <>
          <section className="card grid-two">
            <article>
              <h2>Customer</h2>
              <p><b>Name:</b> {caseData.customer.name}</p>
              <p><b>Phone:</b> {caseData.customer.phone}</p>
              <p><b>Email:</b> {caseData.customer.email}</p>
              <p><b>Risk Score:</b> {caseData.customer.riskScore}</p>
            </article>

            <article>
              <h2>Loan & Case</h2>
              <p><b>Loan ID:</b> {caseData.loan.id}</p>
              <p><b>Outstanding:</b> ${caseData.loan.outstanding}</p>
              <p><b>DPD:</b> {caseData.dpd}</p>
              <p><b>Stage:</b> {caseData.stage}</p>
              <p><b>Status:</b> {caseData.status}</p>
              <p><b>Assigned:</b> {caseData.assignedTo || 'Unassigned'}</p>
              <p><b>Version:</b> {caseData.version}</p>
            </article>
          </section>

          <section className="card">
            <h2>Add Action Log</h2>
            <form className="action-form" onSubmit={submitAction}>
              <select
                value={actionForm.type}
                onChange={(event) => setActionForm((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="CALL">CALL</option>
                <option value="SMS">SMS</option>
                <option value="EMAIL">EMAIL</option>
                <option value="WHATSAPP">WHATSAPP</option>
              </select>

              <select
                value={actionForm.outcome}
                onChange={(event) => setActionForm((prev) => ({ ...prev, outcome: event.target.value }))}
              >
                <option value="NO_ANSWER">NO_ANSWER</option>
                <option value="PROMISE_TO_PAY">PROMISE_TO_PAY</option>
                <option value="PAID">PAID</option>
                <option value="WRONG_NUMBER">WRONG_NUMBER</option>
              </select>

              <input
                required
                value={actionForm.notes}
                onChange={(event) => setActionForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Action notes"
              />

              <button className="primary" type="submit">Add</button>
            </form>
          </section>

          <section className="card">
            <h2>Action Logs</h2>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Outcome</th>
                  <th>Notes</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {caseData.actionLogs.length ? (
                  caseData.actionLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.type}</td>
                      <td>{log.outcome}</td>
                      <td>{log.notes}</td>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No action logs</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Assignment Decisions</h2>
            <table>
              <thead>
                <tr>
                  <th>Matched Rules</th>
                  <th>Reason</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {caseData.ruleDecisions.length ? (
                  caseData.ruleDecisions.map((decision) => (
                    <tr key={decision.id}>
                      <td>{Array.isArray(decision.matchedRules) ? decision.matchedRules.join(', ') : '-'}</td>
                      <td>{decision.reason}</td>
                      <td>{new Date(decision.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No decisions recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
