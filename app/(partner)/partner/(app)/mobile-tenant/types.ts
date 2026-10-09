export type OccupancyDetail = {
  occupancy_id: number | null;
  unit_id: number;
  building_id: number;
  building_name: string;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  payer_name: string | null;
  phone: string | null;
  phones_more: string[];
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
  /** 파트너 이사정산 등록 화면이 저장한 수납액(moving_settlements.extra.paid). 없으면 0. */
  paid_amount: number;
  move_out_date: string | null;
  created_at: string;
};

export type MobileTenantData = {
  occupancy: OccupancyDetail | null;
  payments: PaymentRow[];
  settlements: MovingSettlement[];
};
