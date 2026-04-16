export type ERPQuoteStatus = 'sent' | 'approved' | 'converted' | 'rejected'
export type ERPInvoiceType = 'transaction_statement' | 'tax_invoice'
export type ERPInvoiceStatus = 'issued' | 'cancelled'

export interface ERPQuote {
  id: string
  quote_number: string
  title: string
  status: ERPQuoteStatus
  supply_amount: number
  tax_amount: number
  total_amount: number
  valid_until: string | null
  created_at: string
  sent_at: string | null
}

export interface ERPQuoteItem {
  description: string
  specification: string | null
  quantity: number
  unit: string
  unit_price: number
  supply_amount: number
  tax_amount: number
  amount: number
  sort_order: number
}

export interface ERPQuoteDetail extends ERPQuote {
  clients: { id: string; name: string; clinic_id: string } | null
  quote_items: ERPQuoteItem[]
}

export interface ERPInvoice {
  id: string
  invoice_number: string
  type: ERPInvoiceType
  status: ERPInvoiceStatus
  supply_amount: number
  tax_amount: number
  total_amount: number
  issue_date: string
  created_at: string
}

export interface ERPPagination {
  page: number
  totalPages: number
  totalCount: number
}

export interface ERPRespondResult {
  success: boolean
  data?: { id: string; status: ERPQuoteStatus }
  error?: string
}

// --- 거래처 동기화 ---

export interface ERPClient {
  id: string
  name: string
  business_number: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  created_at: string
}

export interface ERPClientListResponse {
  success: boolean
  data: ERPClient[]
  pagination: ERPPagination
}

export interface ERPClientCreateResponse {
  success: boolean
  data: { id: string; name: string }
}
