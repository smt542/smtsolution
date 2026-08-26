import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { buildingKeys } from "@/hooks/reactquery/buildings/keys";
import { occupancyKeys } from "@/hooks/reactquery/occupancies/keys";
import { receiptKeys } from "./queries";

export interface SaveBuildingNotesInput {
  buildingId: number;
  memo: string;
  billingNote: string;
}

async function saveBuildingNotes(input: SaveBuildingNotesInput): Promise<void> {
  const { error } = await createClient().rpc("receipts_save_building_notes", {
    p_building_id: input.buildingId,
    p_memo: input.memo,
    p_billing_note: input.billingNote,
  });
  if (error) throw new Error(error.message);
}

export function useSaveBuildingNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveBuildingNotes,
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: buildingKeys.directory(), exact: true });
      void qc.invalidateQueries({ queryKey: buildingKeys.full(input.buildingId), exact: true });
    },
  });
}

export interface SaveOccupancyFieldsInput {
  orgId: number;
  buildingId: number;
  unitId: number;
  period: string;
  occupancyId: number;
  tenantName: string;
  payerName: string;
  phone: string;
  moveInDate: string | null;
  moveOutDate: string | null;
  note: string;
  billingEnabled: boolean;
  printEnabled: boolean;
  smsOptIn: boolean;
  alimtalkOptIn: boolean;
}

async function saveOccupancyFields(input: SaveOccupancyFieldsInput): Promise<void> {
  const { error } = await createClient().rpc("receipts_save_occupancy_fields", {
    p_occupancy_id: input.occupancyId,
    p_tenant_name: input.tenantName,
    p_payer_name: input.payerName,
    p_phone: input.phone,
    p_move_in_date: input.moveInDate,
    p_move_out_date: input.moveOutDate,
    p_note: input.note,
    p_billing_enabled: input.billingEnabled,
    p_print_enabled: input.printEnabled,
    p_sms_opt_in: input.smsOptIn,
    p_alimtalk_opt_in: input.alimtalkOptIn,
  });
  if (error) throw new Error(error.message);
}

export function useSaveOccupancyFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveOccupancyFields,
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: occupancyKeys.full(input.unitId), exact: true });
      void qc.invalidateQueries({ queryKey: occupancyKeys.byUnit(input.unitId), exact: true });
      void qc.invalidateQueries({
        queryKey: occupancyKeys.tenantList(input.buildingId),
        exact: true,
      });
      void qc.invalidateQueries({
        queryKey: receiptKeys.workspace(input.orgId, input.period),
        exact: true,
      });
      void qc.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (
            key[0] !== receiptKeys.all[0]
            || key[1] !== "statement"
            || key[2] !== input.buildingId
          ) {
            return false;
          }
          const scope = key[3];
          const startPeriod = key[4];
          const endPeriod = key[5];
          return (scope === "building" || scope === input.unitId)
            && typeof startPeriod === "string"
            && typeof endPeriod === "string"
            && startPeriod <= input.period
            && endPeriod >= input.period;
        },
      });
    },
  });
}
