import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Input, Modal, Spinner } from "@/components/common";
import {
  useSaveUtilitySupplier,
  useUtilitySupplier,
} from "@/hooks/reactquery/utilities";

interface GasSupplierModalProps {
  open: boolean;
  buildingId: number;
  onClose: () => void;
}

interface SupplierDraft {
  companyName: string;
  phone: string;
  bank: string;
  accountNo: string;
  accountHolder: string;
}

const EMPTY_DRAFT: SupplierDraft = {
  companyName: "",
  phone: "",
  bank: "",
  accountNo: "",
  accountHolder: "",
};

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function GasSupplierModal({
  open,
  buildingId,
  onClose,
}: GasSupplierModalProps) {
  const supplierQuery = useUtilitySupplier(buildingId, "gas");
  const saveSupplier = useSaveUtilitySupplier();
  const [draft, setDraft] = useState<SupplierDraft | null>(null);
  const supplier = supplierQuery.data;
  const isSupplierRefreshing = supplierQuery.isFetching && !supplierQuery.isLoading;
  const values = draft ?? {
    companyName: supplier?.companyName ?? EMPTY_DRAFT.companyName,
    phone: supplier?.phone ?? EMPTY_DRAFT.phone,
    bank: supplier?.bank ?? EMPTY_DRAFT.bank,
    accountNo: supplier?.accountNo ?? EMPTY_DRAFT.accountNo,
    accountHolder: supplier?.accountHolder ?? EMPTY_DRAFT.accountHolder,
  };

  const update = (field: keyof SupplierDraft, value: string) => {
    setDraft({ ...values, [field]: value });
  };

  const close = () => {
    setDraft(null);
    onClose();
  };

  const submit = () => {
    saveSupplier.mutate(
      {
        buildingId,
        utilityType: "gas",
        companyName: nullable(values.companyName),
        phone: nullable(values.phone),
        bank: nullable(values.bank),
        accountNo: nullable(values.accountNo),
        accountHolder: nullable(values.accountHolder),
      },
      {
        onSuccess: () => {
          toast.success("가스 공급자정보를 저장했습니다.");
          close();
        },
        onError: (error) => {
          toast.error(error, "가스 공급자정보 저장에 실패했습니다.");
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={close} title="가스 공급자정보">
      {supplierQuery.isLoading ? (
        <div className="min-h-[200px] py-8">
          <Spinner label="가스 공급자 정보 불러오는 중" showLabel />
        </div>
      ) : supplierQuery.error ? (
        <div className="space-y-4">
          <p role="alert" className="rounded-xl border border-red/20 bg-red-t p-4 text-sm font-semibold text-red">
            공급자정보를 불러오지 못했습니다.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => supplierQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {isSupplierRefreshing ? (
            <div className="absolute right-0 top-0 rounded-lg bg-white/95 shadow-card">
              <Spinner label="가스 공급자 정보 갱신 중" size="small" showLabel className="px-3 py-2" />
            </div>
          ) : null}
          <div className="space-y-4">
            <SupplierField
              label="가스회사명"
              value={values.companyName}
              onChange={(value) => update("companyName", value)}
            />
            <SupplierField
              label="전화"
              value={values.phone}
              onChange={(value) => update("phone", value)}
            />
            <SupplierField
              label="은행"
              value={values.bank}
              onChange={(value) => update("bank", value)}
            />
            <SupplierField
              label="계좌번호"
              value={values.accountNo}
              onChange={(value) => update("accountNo", value)}
            />
            <SupplierField
              label="예금주"
              value={values.accountHolder}
              onChange={(value) => update("accountHolder", value)}
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>취소</Button>
            <Button type="button" onClick={submit} disabled={saveSupplier.isPending}>
              {saveSupplier.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SupplierField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-t2">{label}</span>
      <Input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
