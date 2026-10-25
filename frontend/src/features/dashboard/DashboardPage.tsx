import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, ArrowRightLeft, CheckCheck, ChevronRight, CircleAlert, ClipboardList,
  Clock3, FileCheck2, FileInput, FileText, Layers3, ListChecks, RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Batch, Run, Workspace } from '../../types/api'
import { api } from '../../lib/api'
import { Badge, displayTime, EmptyState, ErrorMessage, Loading, Money } from '../../components/common'

type DashboardData = { latest_run: Run | null; recent_runs: Run[]; recent_imports: Batch[] }
const number = (value: number) => value.toLocaleString('en-GB')

export function DashboardPage({ demo = false }: { demo?: boolean }) {
  const prefix = demo ? '/demo' : ''
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace'), enabled: demo })
  const result = useQuery({ queryKey: ['dashboard', ...(demo ? ['demo'] : [])], queryFn: () => api<DashboardData>('/dashboard') })
  const run = result.data?.latest_run
  const summary = run?.status === 'completed' ? run.current_summary : undefined
  const categories = Object.entries(summary?.category_counts || {}).filter(([, count]) => count > 0).sort(([left, a], [right, b]) => b - a || left.localeCompare(right))
  const categoryTotal = categories.reduce((total, [, count]) => total + count, 0)
  const runQuery = run ? `?run=${encodeURIComponent(run.id)}` : ''
  const recentRuns = result.data?.recent_runs.slice(0, 5) || []
  const recentImports = result.data?.recent_imports.slice(0, 5) || []
  const nextAction = demo
    ? { title: 'Follow the evidence', description: 'Explore accepted matches and open cases. Trace a result back to the records and rules behind it.', label: 'Explore reconciliation', path: `/reconciliation${runQuery}` }
    : run?.is_stale
      ? { title: 'Bring the snapshot up to date', description: 'Inputs or rules have changed since this run. Open reconciliation to create a snapshot that includes those changes.', label: 'Open reconciliation', path: '/reconciliation' }
      : summary?.unresolved_discrepancy_count
        ? { title: 'Review the outstanding evidence', description: 'Open the investigation queue, inspect supporting records, and document a decision for each case.', label: 'Open investigations', path: `/investigations${runQuery}` }
        : { title: 'Review the completed results', description: 'Inspect the recorded summary and review decisions in Reports before sharing the reconciliation results.', label: 'Open reports', path: `/reports${runQuery}` }

  return <div className="workspace-dashboard">
    <div className="page-heading dashboard-heading">
      <div><div className="eyebrow">OPERATIONS OVERVIEW</div><h1>Dashboard</h1><p>Reconciliation results and the work that needs your attention.</p></div>
      <Link className="button primary" to={`${prefix}${demo ? '/reconciliation' : '/imports'}`}>{demo ? <ArrowRightLeft size={16} aria-hidden="true" /> : <FileInput size={16} aria-hidden="true" />}{demo ? 'Explore reconciliation' : 'Import records'}<ArrowRight size={15} aria-hidden="true" /></Link>
    </div>

    <ErrorMessage error={result.error} />
    {demo && workspace.data?.demo?.ai_case_id && <section className="panel case-content"><div className="next-action-kicker"><FileText size={17} aria-hidden="true" /><span>AI INVESTIGATION EXAMPLE</span></div><h2>Inspect a saved OpenAI hypothesis</h2><p>An actual provider response explains a synthetic case using validated evidence. The explanation supports human review and does not change financial results.</p><Link className="button secondary" to={`/demo/investigations?case=${workspace.data.demo.ai_case_id}`}>View AI explanation<ArrowRight size={15} /></Link></section>}
    {result.isLoading && <Loading />}
    {result.data && !run && <section className="panel dashboard-empty">
      <EmptyState title={demo ? 'No completed sample run available' : 'Build your first reconciliation'}>{demo ? 'A completed run is needed to show the sample overview. Explore reconciliation to inspect the available records.' : 'Start with your source files. Import orders, payments, and settlements, then run reconciliation to see matches and review cases here.'}</EmptyState>
      <div className="empty-action"><Link to={`${prefix}${demo ? '/reconciliation' : '/imports'}`} className="button primary">{demo ? 'Explore reconciliation' : 'Import your first file'}<ArrowRight size={15} aria-hidden="true" /></Link></div>
    </section>}
    {run && !summary && <div className="alert warning"><CircleAlert size={17} aria-hidden="true" /><span>This run is {run.status}. A completed run is needed before summary values can be shown. <Link className="text-link" to={`${prefix}/reconciliation${runQuery}`}>Open reconciliation<ArrowRight size={14} aria-hidden="true" /></Link></span></div>}

    {summary && run && <>
      <div className="dashboard-snapshot">
        <div><span className="snapshot-label"><Clock3 size={14} aria-hidden="true" />Latest completed run</span><Link className="text-link" to={`${prefix}/reconciliation${runQuery}`}><code>{run.id.slice(0, 8)}</code><ChevronRight size={13} aria-hidden="true" /></Link><time dateTime={run.completed_at || run.started_at}>{displayTime(run.completed_at || run.started_at)}</time></div>
        {run.is_stale ? <span className="snapshot-stale"><RefreshCw size={13} aria-hidden="true" />Inputs or rules have changed</span> : <span className="snapshot-revision">Input revision {run.input_revision}</span>}
      </div>

      <div className="metrics-grid dashboard-metrics">
        <article className="metric overview-metric"><div className="metric-label"><span>Matched order value</span><CheckCheck size={17} aria-hidden="true" /></div><strong className="metric-money positive"><Money amounts={summary.matched_order_value} /></strong><small><span className="metric-detail-count">{number(summary.matched_order_count)}</span> accepted order relationships</small></article>
        <article className="metric overview-metric"><div className="metric-label"><span>Matched settlement net</span><FileCheck2 size={17} aria-hidden="true" /></div><strong className="metric-money positive"><Money amounts={summary.matched_settlement_value || {}} /></strong><small><span className="metric-detail-count">{number(summary.matched_settlement_count || 0)}</span> accepted settlement relationships</small></article>
        <article className="metric overview-metric"><div className="metric-label"><span>Unresolved cases</span><ClipboardList size={17} aria-hidden="true" /></div><strong className={summary.unresolved_discrepancy_count ? 'warning-text' : 'positive'}>{number(summary.unresolved_discrepancy_count)}</strong><small>Cases awaiting a documented review decision</small></article>
        <article className="metric overview-metric"><div className="metric-label"><span>Missing settlement evidence</span><CircleAlert size={17} aria-hidden="true" /></div><strong>{number(summary.missing_settlement_evidence_count || 0)}</strong><small>Missing records do not prove settlement failure</small></article>
      </div>

      <section className="dashboard-source-strip" aria-label="Source records in this snapshot">
        <div className="source-strip-label"><Layers3 size={18} aria-hidden="true" /><span>Snapshot<br /><strong>Source coverage</strong></span></div>
        <dl><div><dt>Orders</dt><dd>{number(summary.total_orders)}</dd></div><div><dt>Payment records</dt><dd>{number(summary.total_payment_records)}</dd></div><div><dt>Settlement records</dt><dd>{number(summary.total_settlement_records)}</dd></div></dl>
        <Link className="text-link" to={`${prefix}/reconciliation${runQuery}`}>Inspect snapshot<ArrowRight size={14} aria-hidden="true" /></Link>
      </section>

      <div className="dashboard-overview-grid">
        <section className="panel dashboard-categories" aria-labelledby="dashboard-categories-title">
          <div className="panel-heading"><div><h2 id="dashboard-categories-title">Outstanding categories</h2><p>Where unresolved review cases are concentrated.</p></div><span className="count-label">{number(categories.length)} {categories.length === 1 ? 'category' : 'categories'}</span></div>
          {categories.length ? <><div className="category-list-heading"><span>Case category</span><span>Cases / share</span></div><ul className="dashboard-category-list">{categories.map(([category, count]) => {
            const share = count / categoryTotal * 100
            return <li key={category}><div className="category-row"><span>{category.replaceAll('_', ' ')}</span><div><strong>{number(count)}</strong><span>{share.toFixed(1)}%</span></div></div><div className="category-track" aria-hidden="true"><div className="category-fill" style={{ width: `${share}%` }} /></div></li>
          })}</ul><div className="category-panel-footer"><span>Share of listed cases. Related cases can reference the same evidence.</span><Link className="text-link" to={`${prefix}/investigations${runQuery}`}>Review cases<ArrowRight size={14} aria-hidden="true" /></Link></div></> : <EmptyState title="No outstanding cases">All cases in this snapshot satisfy their applicable rules or have documented review decisions.</EmptyState>}
        </section>

        <div className="dashboard-context-column">
          <section className="panel dashboard-next-action" aria-labelledby="dashboard-next-title"><div className="next-action-kicker"><ListChecks size={17} aria-hidden="true" /><span>SUGGESTED NEXT STEP</span></div><h2 id="dashboard-next-title">{nextAction.title}</h2><p>{nextAction.description}</p><Link className="button primary" to={`${prefix}${nextAction.path}`}>{nextAction.label}<ArrowRight size={15} aria-hidden="true" /></Link><div className="next-action-reference"><span>Run reference</span><code>{run.id.slice(0, 8)}</code><span>Rule version</span><strong>{run.rule_version}</strong></div></section>
          <section className="panel dashboard-value-context" aria-labelledby="dashboard-value-title"><h2 id="dashboard-value-title">Recorded value in scope</h2><dl><div><dt>Eligible payment value</dt><dd><Money amounts={summary.total_payment_value} /></dd></div><div><dt>Affected recorded value</dt><dd><Money amounts={summary.unresolved_discrepancy_value} /></dd></div></dl><p>Currencies stay separate. Affected value counts connected evidence once. It represents review exposure, not financial loss.</p></section>
        </div>
      </div>
    </>}

    {result.data && <div className="dashboard-activity-grid">
      <section className="panel dashboard-runs" aria-labelledby="dashboard-runs-title"><div className="panel-heading"><div><h2 id="dashboard-runs-title">Recent reconciliation runs</h2><p>The latest recorded execution and review status.</p></div><Link className="text-link" to={`${prefix}/reconciliation`}>View all<ArrowRight size={14} aria-hidden="true" /></Link></div>
        {recentRuns.length ? <div className="table-scroll"><table><caption className="sr-only">Recent reconciliation runs, newest first</caption><thead><tr><th scope="col">Run / started</th><th scope="col">Status</th><th scope="col" className="number">Open cases</th><th scope="col"><span className="sr-only">Results</span></th></tr></thead><tbody>{recentRuns.map(item => <tr key={item.id}><td><Link className="table-link" to={`${prefix}/reconciliation?run=${encodeURIComponent(item.id)}`}><ArrowRightLeft size={14} aria-hidden="true" /><code>{item.id.slice(0, 8)}</code></Link><time className="activity-secondary" dateTime={item.started_at}>{displayTime(item.started_at)}</time></td><td><Badge value={item.status} /></td><td className="number">{item.status === 'completed' ? number(item.current_summary.unresolved_discrepancy_count) : 'Unavailable'}</td><td><Link className="text-link nowrap" to={`${prefix}/reconciliation?run=${encodeURIComponent(item.id)}`} aria-label={`Open run ${item.id.slice(0, 8)}`}>Open<ArrowRight size={13} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="No reconciliation runs yet">Completed runs and their review status will appear here.</EmptyState>}
      </section>

      <section className="panel dashboard-imports" aria-labelledby="dashboard-imports-title"><div className="panel-heading"><div><h2 id="dashboard-imports-title">Recent source files</h2><p>Imported evidence and validation status.</p></div><Link className="text-link" to={`${prefix}/imports`}>View all<ArrowRight size={14} aria-hidden="true" /></Link></div>
        {recentImports.length ? <div className="table-scroll"><table><caption className="sr-only">Recent source files, newest first</caption><thead><tr><th scope="col">Source file</th><th scope="col">Status</th><th scope="col" className="number">Rows</th><th scope="col">Created</th></tr></thead><tbody>{recentImports.map(batch => <tr key={batch.id}><td className="source-cell"><Link className="table-link" to={`${prefix}/imports?batch=${encodeURIComponent(batch.id)}`}><FileText size={15} aria-hidden="true" /><span>{batch.filename}</span></Link><span className="activity-secondary source-type">{batch.source_type}</span></td><td><Badge value={batch.status} /></td><td className="number">{number(batch.total_rows)}</td><td><time className="activity-time" dateTime={batch.created_at}>{displayTime(batch.created_at)}</time></td></tr>)}</tbody></table></div> : <EmptyState title="No source files yet">Source files appear here after an import preview is created.</EmptyState>}
      </section>
    </div>}
    {result.data && <p className="dashboard-bottom-note"><FileText size={14} aria-hidden="true" />{demo ? 'Synthetic sample records. Values are calculated from the sample workspace.' : 'Summary values reflect the latest completed snapshot and its current review decisions.'}</p>}
  </div>
}
