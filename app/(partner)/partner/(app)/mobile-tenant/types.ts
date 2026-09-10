export type OccupancyDetail = {
  unit_id: number;
  building_id: number;
  building_name: string;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  payer_name: string | null;
  phone: string | null;
  resident_count: number | null;
  vehicle_no: string | null;
  move_in_date: string | null;
  status: string;
};

export type PaymentRow = {
  period: string;
  due_date: string | null;
  charged: number;
  paid: number;
  unpaid: number;
  last_paid_at: string | null;
  methods: string | null;
  memo: string | null;
};

export type MovingSettlement = {
  id: number;
  tenant_name: string | null;
  status: string;
  settlement_amount: number | null;
  move_out_date: string | null;
  created_at: string;
};

export type MobileTenantData = {
  occupancy: OccupancyDetail | null;
  payments: PaymentRow[];
  settlements: MovingSettlement[];
};
