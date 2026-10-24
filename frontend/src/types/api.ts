export type MoneyMap = Record<string, string>
export type SourceType = 'orders' | 'payments' | 'settlements'
export type Page<T> = { items: T[]; total: number; page: number; page_size: number }
export type Workspace = {
  id: string; name: string; operator: string; mode: string; input_revision: number
  available_sources: SourceType[]; rule_scope: string; currency_precision: Record<string, number>
  max_upload_bytes?: number
  fee_configuration?: FeeConfiguration
}
export type FeeConfiguration = { name: string; synthetic: boolean; rules: Record<string, Record<string, { basis_points: number; fixed_minor: number }>> }
export type ImportOptions = {
  sheet?: string | null; header_row?: number | null; column_map: Record<string, string | null>
  default_currency: string; default_provider: string; default_status: string; default_date: string
  timezone: string; date_order: 'DMY' | 'MDY'; decimal_style: 'auto' | 'dot' | 'comma'
  allow_cached_formulas: boolean; status_map: Record<string, string>
  amount_unit?: 'major' | 'minor'
  corrections: Record<string, Record<string, string>>; excluded_rows: number[]; reason: string; expected_revision?: number
}
export type ImportInfo = {
  format: string; encoding: string | null; delimiter: string | null; sheets: string[]; sheet: string
  header_row: number; mapping: Record<string, string | null>; fields: { key: string; label: string; required: boolean }[]
  options: ImportOptions; revision: number; transformed_rows: number; excluded_rows: number
  unknown_statuses: string[]; allowed_statuses: string[]
}
export type PreviewRow = {
  source_row: number; raw: Record<string, string>; parsed: Record<string, string | null>
  errors: { field: string; message: string }[]; warnings: string[]
  values?: Record<string, string>; edit_values?: Record<string, string>; transformations?: string[]; excluded?: boolean
}
export type Batch = {
  id: string; filename: string; source_type: SourceType; checksum: string
  status: 'previewed' | 'invalid' | 'confirmed'; total_rows: number; valid_rows: number; invalid_rows: number
  created_at: string; confirmed_at: string | null; preview: Page<PreviewRow> & { columns: string[] }
  import_info?: ImportInfo | null
}
export type Summary = {
  total_orders: number; cancelled_orders: number; total_payment_records: number; total_eligible_payments: number
  matched_order_count: number; total_payment_value: MoneyMap; matched_order_value: MoneyMap
  unresolved_discrepancy_count: number; unresolved_discrepancy_value: MoneyMap
  duplicate_notification_count: number; excluded_duplicate_payment_records: number
  excluded_duplicate_payment_value: MoneyMap; missing_payment_count: number; category_counts: Record<string, number>
  match_count: number; total_settlement_records: number; matched_settlement_count: number
  matched_settlement_value: MoneyMap; missing_settlement_evidence_count: number
}
export type Run = {
  id: string; status: 'running' | 'completed' | 'failed'; started_at: string; completed_at: string | null
  input_revision: number; snapshot_hash: string; rule_version: string; failure_code: string | null
  is_stale: boolean; source_counts: Record<string, number>; original_summary: Summary; current_summary: Summary
  fee_configuration?: FeeConfiguration
}
export type SourceRecord = {
  id: string; record_type: 'order' | 'payment' | 'settlement'; currency: string
  expected_minor?: string; amount_minor?: string; gross_minor?: string; fee_minor?: string; net_minor?: string
  order_ref?: string | null; transaction_ref?: string; provider?: string; source_filename?: string
  ordered_at?: string; paid_at?: string; settled_at?: string; settlement_ref?: string; payment_ref?: string; status?: string; provider_status?: string
  import_batch_id: string; source_row: number; raw: Record<string, string>; description: string
  interpretation?: { sheet: string | null; row_changes: string[]; correction_reason: string | null; timezone: string | null }
}
export type Evidence = { records: string[]; rule: string; candidates?: { order_ids?: string[]; payment_ids?: string[]; settlement_ids?: string[] }; details?: Record<string, unknown> }
export type Match = {
  id: string; run_id: string; kind: string; origin: string; order_id: string | null; payment_id: string; settlement_id: string | null
  evidence: Evidence; source_records: SourceRecord[]
}
export type Discrepancy = {
  id: string; run_id: string; type: string; severity: 'low' | 'medium' | 'high'; status: string
  description: string; evidence: Evidence; source_records: SourceRecord[]; version: number
}
