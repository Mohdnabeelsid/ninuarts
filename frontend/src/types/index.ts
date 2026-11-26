// Core Domain Types for Ninu Arts Business Manager

export type UserRole = "OWNER" | "STAFF";

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
}

export type LeadSource = "INSTAGRAM" | "WHATSAPP" | "REFERRAL" | "DIRECT";

export interface CustomerNote {
  id: number;
  customer_id: number;
  user_id: number;
  user?: { id: number; name: string };
  note: string;
  created_at: string;
}

export interface CustomerOccasion {
  id: number;
  customer_id: number;
  occasion_type: string;
  occasion_date: string;
  relationship?: string | null;
  notes?: string | null;
}

export interface Customer {
  id: number;
  customer_code?: string;
  name: string;
  phone: string;
  instagram_handle?: string | null;
  email?: string | null;
  source_channel: LeadSource;
  delivery_address?: string | null;
  city: string;
  pincode?: string | null;
  notes?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  created_at: string;
  orders_count?: number;
  lifetime_spend?: number;
  notes_history?: CustomerNote[];
  occasions?: CustomerOccasion[];
  orders?: Order[];
  enquiries?: Enquiry[];
}

export type EnquiryStatus = "NEW" | "CONTACTED" | "DISCUSSING" | "QUOTED" | "ESTIMATE_SENT" | "CONVERTED" | "LOST";

export interface FollowUpItem {
  id: number;
  enquiry_id: number;
  user_id?: number | null;
  operator?: { id: number; name: string };
  scheduled_date: string;
  completed_at?: string | null;
  notes?: string | null;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  created_at: string;
}

export interface Enquiry {
  id: number;
  customer_id: number;
  customer?: Customer;
  channel: "INSTAGRAM" | "WHATSAPP" | "CALL" | "OTHER";
  product_interest: string;
  estimated_value?: number | null;
  budget_range?: string | null;
  enquiry_date?: string | null;
  requirements?: string | null;
  status: EnquiryStatus;
  lost_reason?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  converted_order_id?: number | null;
  converted_order?: Order | null;
  follow_ups?: FollowUpItem[];
  created_at: string;
}

export interface ProductCategoryItem {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  products_count?: number;
}

export interface Product {
  id: number;
  category_id?: number | null;
  name: string;
  category: string;
  category_ref?: ProductCategoryItem | null;
  category_relation?: ProductCategoryItem | null;
  base_price: number;
  description?: string | null;
  image_url?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  created_at?: string;
}

export type OrderStatus =
  | "DRAFT"
  | "PENDING_ADVANCE"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "READY_FOR_DELIVERY"
  | "DISPATCHED"
  | "DELIVERED"
  | "ON_HOLD"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID";

export type PaymentMethod = "UPI" | "BANK_TRANSFER" | "CASH";

export interface OrderItemCostItem {
  id?: number;
  order_item_id?: number;
  cost_type: "RAW_MATERIAL" | "PRINT" | "FRAME" | "PACKAGING" | "OTHER";
  amount: number;
  description?: string | null;
}

export interface OrderItem {
  id?: number;
  product_id?: number | null;
  item_name: string;
  item_type: "CATALOG" | "CUSTOM";
  unit_price: number;
  quantity: number;
  total_price: number;
  customization_details?: string | null;
  costs?: OrderItemCostItem[];
}

export interface Payment {
  id: number;
  order_id: number;
  payment_type: "ADVANCE" | "PARTIAL" | "INTERIM" | "ADDITIONAL" | "BALANCE_FINAL";
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference?: string | null;
  payment_date: string;
  status: "SUCCESS" | "VOIDED";
  notes?: string | null;
  recorder?: { id: number; name: string };
}

export interface Refund {
  id: number;
  order_id: number;
  payment_id?: number | null;
  amount: number;
  refund_method: PaymentMethod;
  transaction_reference?: string | null;
  reason: string;
  notes?: string | null;
  refund_date: string;
  status: "COMPLETED" | "FAILED";
  processor?: { id: number; name: string };
}

export type DeliveryStatus =
  | "PENDING"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RETURNED";

export interface Delivery {
  id: number;
  order_id: number;
  order?: Order;
  delivery_type: "COURIER" | "LOCAL_DELIVERY";
  recipient_name?: string | null;
  recipient_phone?: string | null;
  delivery_address?: string | null;
  courier_partner?: string | null;
  tracking_number?: string | null;
  shipping_charge?: number;
  dispatch_date?: string | null;
  shipped_date?: string | null;
  estimated_delivery_date?: string | null;
  delivered_date?: string | null;
  delivery_notes?: string | null;
  delay_reason?: string | null;
  status: DeliveryStatus;
  is_overdue?: boolean;
  days_overdue?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OrderStatusHistoryItem {
  id: number;
  order_id: number;
  user_id?: number | null;
  user?: { id: number; name: string };
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  created_at: string;
}

export interface OrderModification {
  id: number;
  order_id: number;
  modified_by?: number | null;
  modifier?: { id: number; name: string };
  previous_values?: any;
  new_values?: any;
  previous_total: number;
  new_total: number;
  modification_reason?: string | null;
  change_summary: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer?: Customer;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_amount: number;
  delivery_charge: number;
  discount_amount: number;
  total_amount: number;
  advance_amount_required: number;
  total_paid: number;
  balance_amount: number;
  confirmed_at?: string | null;
  target_delivery_date?: string | null;
  internal_notes?: string | null;
  created_at: string;
  items?: OrderItem[];
  payments?: Payment[];
  refunds?: Refund[];
  delivery?: Delivery | null;
  fulfillment?: Delivery | null;
  modifications?: OrderModification[];
  modification_history?: OrderModification[];
  status_history?: OrderStatusHistoryItem[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  expenses_count?: number;
}

export interface Expense {
  id: number;
  category_id: number;
  category_name?: string;
  category?: ExpenseCategory;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  vendor_id?: number | null;
  vendor?: VendorEntity | null;
  vendor_name?: string | null;
  bill_reference?: string | null;
  description: string;
  attachment_path?: string | null;
  notes?: string | null;
  recorder?: { id: number; name: string };
  created_at?: string;
}

export interface DashboardMetrics {
  total_revenue_booked: number;
  cash_collected: number;
  outstanding_receivables: number;
  total_expenses: number;
  total_refunds: number;
  net_business_profit: number;
  active_orders_count: Record<string, number>;
  total_customers?: number;
  overdue_deliveries_count?: number;
}

// Business Analytics Report Types
export interface MonthlyRevenueTrendItem {
  month: string;
  label: string;
  recognized_revenue: number;
  cash_collected: number;
  total_payments: number;
  total_refunds: number;
  variance: number;
}

export interface ProductPerformanceItem {
  key: string;
  product_id?: number | null;
  product_name: string;
  item_type: "CATALOG" | "CUSTOM";
  category: string;
  units_sold: number;
  order_count: number;
  revenue: number;
  recorded_direct_cost: number;
  gross_profit: number;
  gross_margin_pct: number;
  has_incomplete_cost: boolean;
}

export interface OrderPerformanceReport {
  summary: {
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    delayed_orders: number;
    completion_rate: number;
  };
  status_breakdown: Array<{
    status: string;
    count: number;
    total_value: number;
  }>;
  trend: Array<{
    month: string;
    order_count: number;
    delivered_count: number;
    cancelled_count: number;
  }>;
}

export interface EnquiryConversionReport {
  conversion_funnel: {
    total_enquiries: number;
    converted_enquiries: number;
    lost_enquiries: number;
    open_enquiries: number;
    closed_conversion_rate: number;
    total_cohort_conversion_rate: number;
  };
  channels: Record<
    string,
    {
      total_enquiries: number;
      converted: number;
      lost: number;
      open: number;
      closed_conversion_rate: number;
      overall_rate: number;
    }
  >;
  lost_reasons: Array<{
    lost_reason: string;
    count: number;
  }>;
}

export interface CustomerAnalyticsReport {
  metrics: {
    total_registered_customers: number;
    verified_purchasing_customers: number;
    single_order_customers: number;
    returning_customers: number;
    repeat_purchase_rate: number;
  };
  top_customers: Array<{
    id: number;
    customer_code?: string;
    name: string;
    phone: string;
    city: string;
    order_count: number;
    total_spent: number;
    average_order_value: number;
  }>;
}

export interface ExpenseAnalyticsReport {
  summary: {
    total_expenses: number;
    total_transactions: number;
  };
  categories: Array<{
    category_name: string;
    category_code: string;
    amount: number;
    count: number;
    percentage_of_total: number;
  }>;
  payment_methods: Array<{
    payment_method: string;
    amount: number;
    count: number;
  }>;
  monthly_trend: Array<{
    month: string;
    label: string;
    total_amount: number;
    count: number;
  }>;
}

export interface DelayedOrderItem {
  order_id: number;
  delivery_id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  expected_delivery_date: string;
  current_status: string;
  order_status: string;
  courier_partner?: string;
  tracking_number?: string;
  days_overdue: number;
  delay_reason?: string;
}

export interface ActivityLog {
  id: number;
  user_id?: number | null;
  user?: {
    id: number;
    name: string;
  };
  action: string;
  entity_type: string;
  entity_id: number;
  description: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface ActivePeriod {
  year: number;
  month: number;
  formatted: string;
  displayLabel: string;
}

export type NotificationType = "ORDER" | "PAYMENT" | "ENQUIRY" | "SYSTEM" | "ALERT";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  link?: string;
}

// Entity Management Types
export type BusinessEntityType = "STUDIO" | "BRANCH" | "WORKSHOP" | "BRAND";

export interface BusinessEntity {
  id: number;
  name: string;
  legal_name?: string | null;
  code: string;
  entity_type: BusinessEntityType;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  upi_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type VendorEntityType = "SUPPLIER" | "PRINT_PARTNER" | "COURIER" | "SERVICE";

export type PaymentTermsType = "IMMEDIATE" | "NET_7" | "NET_15" | "NET_30" | "ADVANCE";

export interface VendorEntity {
  id: number;
  name: string;
  code: string;
  entity_type: VendorEntityType;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  gstin?: string | null;
  upi_id?: string | null;
  payment_terms: PaymentTermsType;
  default_category?: string | null;
  tracking_url_template?: string | null;
  is_active: boolean;
  notes?: string | null;
  expense_count?: number;
  total_spent?: number;
  delivery_count?: number;
  created_at?: string;
  updated_at?: string;
}
