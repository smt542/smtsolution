// app/(staff)/staff/buildings/[id]/components/TenantForm.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, EmptyState, Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { occupancyBasicSchema } from "@/components/forms/schema/occupancy";
import { PageHeader } from "@/components/shell/PageHeader";
import { displayUnitNo } from "@/lib/bill/document";
import { deleteImpactWarning } from "@/lib/buildings/deleteImpact";
import { currentPeriod } from "@/lib/billing/period";
import { billingKeys, listBilling, useChargeNewOccupancies } from "@/hooks/reactquery/billing";
import { useCustomerNumbers, type CustomerNumberKind } from "@/hooks/reactquery/buildingCustomerNumbers";
import { useBuildingFull } from "@/hooks/reactquery/buildings";
import {
  unitDeleteImpactQuery,
  useDeleteUnit,
  useSaveUnitOccupancy,
  useUnitOccupancyFull,
  type SaveUnitOccupancyPayload,
} from "@/hooks/reactquery/occupancies";
import { useRoomTypes } from "@/hooks/reactquery/roomTypes";
import { MoveOutControl } from "./tenant-sections/MoveOutControl";
import { BasicInfoSection, type BasicValue } from "./tenant-form/sections/BasicInfoSection";
import { BillingSection, type BillingValue } from "./tenant-form/sections/BillingSection";
import {
  BillStatementSection,
  type BillStatementValue,
} from "./tenant-form/sections/BillStatementSection";
import { ContactSection, type ContactValue } from "./tenant-form/sections/ContactSection";
import { LeaseInfoSection, type LeaseValue } from "./tenant-form/sections/LeaseInfoSection";
import { MoveOutHistorySection } from "./tenant-form/sections/MoveOutHistorySection";
import { PropertyInfoSection, type PropertyValue } from "./tenant-form/sections/PropertyInfoSection";
import {
  UtilityCustomerSection,
  type CustomerOptions,
  type UtilityLine,
  type UtilityValue,
} from "./tenant-form/sections/UtilityCustomerSection";

type BasicErrors = Partial<Record<keyof BasicValue, string>>;

const emptyBasic = (): BasicValue => ({
  unitNo: "",
  tenantName: "",
  payerName: "",
  roomTypeId: "",
  residentCount: "",
  areaPyeong: "",
  moveInDate: "",
  expectedMoveInDate: "",
  discountType: "general",
  discountAmount: "",
  etcNote: "",
  settlementNote: "",
});

const emptyContact = (): ContactValue => ({
  phones: [""],
  vehicles: [""],
  smsOptIn: true,
  alimtalkOptIn: true,
  homepagePassword: "",
});

const emptyBilling = (): BillingValue => ({
  mgmtFeeAmount: "",
  moveCleaningFee: "",
  increaseAmount: "",
  billingEnabled: true,
  billingDay: "",
  transferMethod: "giro",
  cmsMemberNo: "",
  cmsContractNo: "",
  lateFeeEnabled: false,
  singlePrint: false,
  billingNote: "",
});

const emptyLine = (): UtilityLine => ({ customerNo: "", meterNo: "" });
const emptyUtility = (): UtilityValue => ({
  water: emptyLine(),
  elec: emptyLine(),
  elecShared: emptyLine(),
  gas: emptyLine(),
  kepco: emptyLine(),
});

const emptyBill = (): BillStatementValue => ({
  printEnabled: true,
  billNameDisplay: "none",
  billDelivery: "alimtalk",
  billAuthInfo: "",
});

const emptyLease = (): LeaseValue => ({
  leaseType: "month",
  startDate: "",
  endDate: "",
  deposit: "",
  depositDate: "",
  monthlyRent: "",
  jeonseDeposit: "",
  bankAccount: "",
});

const emptyProperty = (): PropertyValue => ({
  propertyName: "",
  address: "",
  addressDetail: "",
  propertyType: "oneroom",
  dealType: "direct",
  rentType: "month",
  areaM2: "",
  deposit: "",
  jeonseDeposit: "",
  monthlyRent: "",
  mgmtFeeDesc: "",
  availableDate: "",
  location: "",
  facilities: [],
});

function withoutTrailingBlanks(values: string[]): string[] {
  const next = values.map((value) => value.trim());
  while (next.at(-1) === "") next.pop();
  return next;
}

function withInputSlot(values: string[]): string[] {
  const next = withoutTrailingBlanks(values);
  return next.length > 0 ? next : [""];
}

function optionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TenantForm({
  buildingId,
  unitId,
}: {
  buildingId: number;
  unitId?: number;
}) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const router = useRouter();
  const save = useSaveUnitOccupancy();
  const chargeNew = useChargeNewOccupancies();
  const del = useDeleteUnit();
  const { data: roomTypes } = useRoomTypes();
  const { data: building } = useBuildingFull(buildingId);
  const { data: customerNumbers } = useCustomerNumbers(buildingId);
  const { data: full, isLoading, isError } = useUnitOccupancyFull(unitId ?? 0);

  const [basic, setBasic] = useState<BasicValue>(emptyBasic);
  const [contact, setContact] = useState<ContactValue>(emptyContact);
  const [billing, setBilling] = useState<BillingValue>(emptyBilling);
  const [utility, setUtility] = useState<UtilityValue>(emptyUtility);
  const [bill, setBill] = useState<BillStatementValue>(emptyBill);
  const [lease, setLease] = useState<LeaseValue>(emptyLease);
  const [property, setProperty] = useState<PropertyValue>(emptyProperty);
  const [dirty, setDirty] = useState(false);
  const [basicErrors, setBasicErrors] = useState<BasicErrors>({});
  const [phoneError, setPhoneError] = useState<string>();
  const [previousFull, setPreviousFull] = useState<typeof full>();
  const formBodyRef = useRef<HTMLDivElement>(null);
  const moveOutHistoryRef = useRef<HTMLDivElement>(null);
  const [moveOutHistoryHighlighted, setMoveOutHistoryHighlighted] = useState(false);

  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const roomTypeOptions = useMemo(
    () => (roomTypes ?? []).map((roomType) => ({ value: String(roomType.id), label: roomType.label })),
    [roomTypes],
  );

  const customerOptions = useMemo<CustomerOptions>(() => {
    const optionsFor = (kind: CustomerNumberKind, current: string) => {
      const options = (customerNumbers ?? [])
        .filter((row) => row.kind === kind)
        .map((row) => ({ value: row.customerNo, label: row.customerNo }));
      if (current && !options.some((option) => option.value === current)) {
        options.unshift({ value: current, label: current });
      }
      return options;
    };

    return {
      water: optionsFor("water", utility.water.customerNo),
      elec: optionsFor("elec", utility.elec.customerNo),
      commonElec: optionsFor("common_elec", utility.elecShared.customerNo),
      gas: optionsFor("gas", utility.gas.customerNo),
    };
  }, [
    customerNumbers,
    utility.elec.customerNo,
    utility.elecShared.customerNo,
    utility.gas.customerNo,
    utility.water.customerNo,
  ]);

  // 조회 결과가 처음 도착하거나 쿼리 무효화 뒤 갱신되면 폼 전체를 한 번에 동기화한다.
  if (full && full !== previousFull) {
    setPreviousFull(full);
    const occupancy = full.occupancy;
    const alimtalkOptIn = occupancy?.alimtalkOptIn ?? true;
    const meterLine = (kind: "water" | "elec" | "elec_shared" | "gas" | "kepco") => {
      const meter = full.meters.find((row) => row.utility === kind);
      return { customerNo: meter?.customerNo ?? "", meterNo: meter?.meterNo ?? "" };
    };

    setBasic({
      unitNo: full.unit.unitNo,
      tenantName: occupancy?.tenantName ?? "",
      payerName: occupancy?.payerName ?? "",
      roomTypeId: occupancy?.roomTypeId ? String(occupancy.roomTypeId) : "",
      residentCount: occupancy?.residentCount == null ? "" : String(occupancy.residentCount),
      areaPyeong: full.unit.areaPyeong == null ? "" : String(full.unit.areaPyeong),
      moveInDate: occupancy?.moveInDate ?? "",
      expectedMoveInDate: occupancy?.expectedMoveInDate ?? "",
      discountType: occupancy?.discountType ?? "general",
      discountAmount: occupancy?.discountAmount == null ? "" : String(occupancy.discountAmount),
      etcNote: occupancy?.etcNote ?? "",
      settlementNote: occupancy?.settlementNote ?? "",
    });
    setContact({
      phones: withInputSlot([
        occupancy?.phone ?? "",
        occupancy?.phone2 ?? "",
        occupancy?.phone3 ?? "",
        ...(occupancy?.phonesExtra ?? []),
      ]),
      vehicles: withInputSlot([occupancy?.vehicleNo ?? "", ...(occupancy?.vehiclesExtra ?? [])]),
      smsOptIn: occupancy?.smsOptIn ?? true,
      alimtalkOptIn,
      homepagePassword: occupancy?.homepagePassword ?? "",
    });
    setBilling({
      mgmtFeeAmount: occupancy?.mgmtFeeAmount == null ? "" : String(occupancy.mgmtFeeAmount),
      moveCleaningFee: occupancy?.moveCleaningFee == null ? "" : String(occupancy.moveCleaningFee),
      increaseAmount: occupancy?.increaseAmount == null ? "" : String(occupancy.increaseAmount),
      billingEnabled: occupancy?.billingEnabled ?? true,
      billingDay: occupancy?.billingDay ?? "",
      transferMethod: occupancy?.transferMethod ?? "giro",
      cmsMemberNo: occupancy?.cmsMemberNo ?? "",
      cmsContractNo: occupancy?.cmsContractNo ?? "",
      lateFeeEnabled: occupancy?.lateFeeEnabled ?? false,
      singlePrint: occupancy?.singlePrint ?? false,
      billingNote: occupancy?.billingNote ?? "",
    });
    setUtility({
      water: meterLine("water"),
      elec: meterLine("elec"),
      elecShared: meterLine("elec_shared"),
      gas: meterLine("gas"),
      kepco: meterLine("kepco"),
    });
    setBill({
      printEnabled: occupancy?.printEnabled ?? true,
      billNameDisplay: occupancy?.billNameDisplay ?? "none",
      billDelivery: alimtalkOptIn ? "alimtalk" : "post",
      billAuthInfo: occupancy?.billAuthInfo ?? "",
    });
    setLease({
      leaseType: full.lease?.leaseType ?? "month",
      startDate: full.lease?.startDate ?? "",
      endDate: full.lease?.endDate ?? "",
      deposit: full.lease?.deposit == null ? "" : String(full.lease.deposit),
      depositDate: full.lease?.depositDate ?? "",
      monthlyRent: full.lease?.monthlyRent == null ? "" : String(full.lease.monthlyRent),
      jeonseDeposit: full.lease?.jeonseDeposit == null ? "" : String(full.lease.jeonseDeposit),
      bankAccount: full.lease?.bankAccount ?? "",
    });
    setProperty({
      propertyName: full.property?.propertyName ?? "",
      address: full.property?.address ?? "",
      addressDetail: full.property?.addressDetail ?? "",
      propertyType: full.property?.propertyType ?? "oneroom",
      dealType: full.property?.dealType ?? "direct",
      rentType: full.property?.rentType ?? "month",
      areaM2: full.property?.areaM2 == null ? "" : String(full.property.areaM2),
      deposit: full.property?.deposit == null ? "" : String(full.property.deposit),
      jeonseDeposit: full.property?.jeonseDeposit == null ? "" : String(full.property.jeonseDeposit),
      monthlyRent: full.property?.monthlyRent == null ? "" : String(full.property.monthlyRent),
      mgmtFeeDesc: full.property?.mgmtFeeDesc ?? "",
      availableDate: full.property?.availableDate ?? "",
      location: full.property?.location ?? "",
      facilities: full.property?.facilities ?? [],
    });
    setBasicErrors({});
    setPhoneError(undefined);
    setDirty(false);
  }

  const patch = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: Partial<T>) => {
    setter((current) => ({ ...current, ...value }));
    setDirty(true);
  };

  const onContactChange = (value: Partial<ContactValue>) => {
    patch(setContact)(value);
    if (typeof value.alimtalkOptIn !== "boolean") return;

    setBill((current) => ({
      ...current,
      billDelivery: value.alimtalkOptIn ? "alimtalk" : "post",
    }));
  };

  const onSave = async () => {
    const phones = withoutTrailingBlanks(contact.phones);
    const vehicles = withoutTrailingBlanks(contact.vehicles);
    const tenantName = basic.tenantName.trim();
    const payerName = basic.payerName.trim();
    const roomTypeId = basic.roomTypeId.trim() === "" ? null : Number(basic.roomTypeId);
    const moveInDate = basic.moveInDate.trim();
    const usageType = full?.unit.usageType ?? "residential";
    const floor = full?.unit.floor ?? null;
    const parsed = occupancyBasicSchema.safeParse({
      unitNo: basic.unitNo,
      floor,
      usageType,
      tenantName,
      payerName,
      phone: phones[0] ?? "",
      phone2: phones[1] ?? "",
      phone3: phones[2] ?? "",
      faxNumber: full?.occupancy?.faxNumber ?? "",
      vehicleNo: vehicles[0] ?? "",
      residentCount: optionalNumber(basic.residentCount),
      roomTypeId,
      moveInDate,
    });
    const occupancy = full?.occupancy;
    const hasResident = tenantName !== "" || phones.some((phone) => phone.trim() !== "");
    // 이사중은 유지하고, 입주자명·전화번호가 있으면 입주, 기존 입주는 공실 입력에도 유지하며 나머지는 공실로 저장한다.
    const status = occupancy?.status === "moving_out"
      ? "moving_out"
      : hasResident
        ? "occupied"
        : occupancy?.status === "occupied"
          ? "occupied"
          : "vacant";
    // 공실로 저장되는 호수만 전화번호 없이 저장한다. 나머지는 첫 칸(전화번호(주))이 있어야 한다.
    const phoneMissing = status !== "vacant" && !phones[0];

    if (!parsed.success || phoneMissing) {
      const nextBasicErrors: BasicErrors = {};
      let nextPhoneError = phoneMissing ? "전화번호를 입력해 주세요" : undefined;
      for (const issue of parsed.error?.issues ?? []) {
        const key = String(issue.path[0]);
        if (key === "phone") nextPhoneError ??= issue.message;
        if (
          key === "unitNo" ||
          key === "tenantName" ||
          key === "payerName" ||
          key === "roomTypeId" ||
          key === "residentCount" ||
          key === "moveInDate"
        ) {
          nextBasicErrors[key] ??= issue.message;
        }
      }
      setBasicErrors(nextBasicErrors);
      setPhoneError(nextPhoneError);
      toast.error("필수 항목을 확인해 주세요.");
      return;
    }

    setBasicErrors({});
    setPhoneError(undefined);
    const payload: SaveUnitOccupancyPayload = {
      buildingId,
      unitId: unitId ?? null,
      occupancyId: occupancy?.id ?? null,
      unit: {
        unitNo: parsed.data.unitNo,
        dong: full?.unit.dong ?? null,
        areaPyeong: optionalNumber(basic.areaPyeong),
        roomCount: full?.unit.roomCount ?? null,
        floor: parsed.data.floor ?? null,
        usageType: parsed.data.usageType,
      },
      occupancy: {
        tenantName: tenantName || null,
        payerName: payerName || null,
        phone: phones[0] || null,
        phone2: phones[1] || null,
        phone3: phones[2] || null,
        faxNumber: occupancy?.faxNumber ?? null,
        vehicleNo: vehicles[0] || null,
        residentCount: parsed.data.residentCount ?? null,
        roomTypeId: parsed.data.roomTypeId ?? null,
        moveInDate: parsed.data.moveInDate?.trim() || null,
        moveOutDate: occupancy?.moveOutDate ?? null,
        status,
        billingEnabled: billing.billingEnabled,
        printEnabled: bill.printEnabled,
        lateFeeEnabled: billing.lateFeeEnabled,
        singlePrint: billing.singlePrint,
        billingNote: billing.billingNote || null,
        settlementNote: basic.settlementNote || null,
        facilityNote: occupancy?.facilityNote ?? null,
        transferMethod: billing.transferMethod as SaveUnitOccupancyPayload["occupancy"]["transferMethod"],
        billNameDisplay: bill.billNameDisplay as SaveUnitOccupancyPayload["occupancy"]["billNameDisplay"],
        billDelivery: contact.alimtalkOptIn ? "alimtalk" : "post",
        billAuth: occupancy?.billAuth ?? false,
        moveOutScheduledDate: occupancy?.moveOutScheduledDate ?? null,
        smsOptIn: contact.smsOptIn,
        alimtalkOptIn: contact.alimtalkOptIn,
        expectedMoveInDate: basic.expectedMoveInDate || null,
        discountType: basic.discountType || "general",
        discountAmount: basic.discountType === "general" ? null : optionalNumber(basic.discountAmount),
        homepagePassword: contact.homepagePassword || null,
        mgmtFeeAmount: optionalNumber(billing.mgmtFeeAmount),
        moveCleaningFee: optionalNumber(billing.moveCleaningFee),
        increaseAmount: optionalNumber(billing.increaseAmount),
        billingDay: billing.billingDay || null,
        etcNote: basic.etcNote || null,
        billAuthInfo: bill.billAuthInfo || null,
        cmsMemberNo: billing.transferMethod === "auto_transfer" ? billing.cmsMemberNo || null : null,
        cmsContractNo: billing.transferMethod === "auto_transfer" ? billing.cmsContractNo || null : null,
        phonesExtra: phones.slice(3),
        vehiclesExtra: vehicles.slice(1),
      },
      meters: [
        { utility: "water", ...utility.water },
        { utility: "elec", ...utility.elec },
        { utility: "elec_shared", ...utility.elecShared },
        { utility: "gas", ...utility.gas },
        { utility: "kepco", ...utility.kepco },
      ],
      accounts: (full?.accounts ?? []).map((account) => ({
        kind: account.kind,
        bank: account.bank,
        account: account.account,
        holder: account.holder,
        cmsMemberNo: account.cmsMemberNo,
        payerNo: account.payerNo,
      })),
      lease: {
        deposit: optionalNumber(lease.deposit),
        monthlyRent: optionalNumber(lease.monthlyRent),
        startDate: lease.startDate || null,
        endDate: lease.endDate || null,
        expiryAlert: full?.lease?.expiryAlert ?? false,
        leaseType: lease.leaseType || null,
        depositDate: lease.depositDate || null,
        jeonseDeposit: optionalNumber(lease.jeonseDeposit),
        bankAccount: lease.bankAccount || null,
      },
      property: {
        propertyName: property.propertyName || null,
        address: property.address || null,
        addressDetail: property.addressDetail || null,
        propertyType: property.propertyType || null,
        dealType: property.dealType || null,
        rentType: property.rentType || null,
        areaM2: optionalNumber(property.areaM2),
        deposit: optionalNumber(property.deposit),
        jeonseDeposit: optionalNumber(property.jeonseDeposit),
        monthlyRent: optionalNumber(property.monthlyRent),
        mgmtFeeDesc: property.mgmtFeeDesc || null,
        availableDate: property.availableDate || null,
        location: property.location || null,
        facilities: property.facilities.filter((f) => f.label.trim() !== ""),
      },
    };

    // §3.9 당월 부과가 확정된 건물이면 저장 직전 "이번달 부과?"를 묻는다.
    // 확정 여부·이 세대의 당월 부과 여부는 당월 부과표(list_billing)의 확정일로 판단한다.
    const chargePeriod = currentPeriod();
    const billingRows = await queryClient
      .fetchQuery({
        queryKey: billingKeys.list(buildingId, chargePeriod),
        queryFn: () => listBilling(buildingId, chargePeriod),
      })
      .catch(() => []); // 확정 조회 실패 시 모달 없이 일반 저장
    const buildingConfirmed = billingRows.some((row) => row.confirmedAt);
    const unitAlreadyCharged =
      unitId != null && billingRows.some((row) => row.unitId === unitId && row.confirmedAt);
    const askChargeThisMonth = buildingConfirmed && status === "occupied" && !unitAlreadyCharged;

    let chargeThisMonth = false;
    if (askChargeThisMonth) {
      const year = Number(chargePeriod.slice(0, 4));
      const month = Number(chargePeriod.slice(5, 7));
      chargeThisMonth = await confirm({
        title: "이번달 관리비 부과",
        description: (
          <>
            {"이번달 관리비 부과를 하시겠습니까?\n"}
            {year}년 {month}월분 부과가 이미 확정된 건물입니다. 부과하면{" "}
            <b>입주일 기준 일할 계산</b>되어 반영됩니다.
          </>
        ),
        confirmLabel: "이번 달 부과",
        cancelLabel: "다음달부터",
      });
    }

    try {
      const result = await save.mutateAsync(payload);
      if (askChargeThisMonth && chargeThisMonth) {
        await chargeNew.mutateAsync({ buildingId, period: chargePeriod, unitIds: [result.unitId] });
        toast.success("이번 달 관리비가 부과되었습니다.");
      } else if (askChargeThisMonth) {
        toast.success("다음달부터 부과됩니다.");
      } else {
        toast.success("저장되었습니다.");
      }
      setDirty(false);
      if (!unitId) router.replace(`/staff/buildings?building=${buildingId}`);
    } catch (error) {
      toast.error(error, "저장에 실패했습니다.");
    }
  };

  const onLeave = async () => {
    if (dirty) {
      const ok = await confirm({ title: "저장하지 않고 나가기", description: "저장하지 않고 나가시겠습니까?", confirmLabel: "나가기" });
      if (!ok) return;
    }
    router.push(`/staff/buildings?building=${buildingId}`);
  };

  const scrollToMoveOutHistory = () => {
    const body = formBodyRef.current;
    const section = moveOutHistoryRef.current;
    if (!body || !section) return;

    const top = section.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    body.scrollTop = Math.max(0, top - 12);
    setMoveOutHistoryHighlighted(true);
    window.setTimeout(() => setMoveOutHistoryHighlighted(false), 1200);
  };

  const pageHeaderActions = (
    <>
      <Button variant="ghost" onClick={onLeave}>{unitId ? "목록으로" : "뒤로가기"}</Button>
      <Button variant="primary" onClick={onSave} disabled={save.isPending}>
        {unitId ? "저장" : "등록 저장"}
      </Button>
    </>
  );

  // 정본 hf-h1 — 상세는 "그린빌라 101호"(건물명·동·호실, 입력 중인 값이 아니라 저장된 호실로 만든다), 등록은 "호수·입주민 등록".
  const pageTitle = unitId
    ? [building?.name, full?.unit.dong, displayUnitNo(full?.unit.unitNo)].filter(Boolean).join(" ")
    : "호수·입주민 등록";

  const pageHeader = (
    <PageHeader
      breadcrumb="건물·입주자 관리"
      title={pageTitle}
      actions={pageHeaderActions}
    />
  );

  if (unitId && isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {pageHeader}
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      </div>
    );
  }

  if (unitId && isError) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {pageHeader}
        <div className="flex flex-1 items-center justify-center px-[24px]">
          <EmptyState message="입주자 정보를 불러오지 못했습니다. 다시 시도해 주세요." />
        </div>
      </div>
    );
  }

  const formContent = (
    <>
      <BasicInfoSection
        value={basic}
        onChange={patch(setBasic)}
        roomTypeOptions={roomTypeOptions}
        errors={basicErrors}
        moveOutControl={unitId && full?.occupancy ? (
          <MoveOutControl
            occupancyId={full.occupancy.id}
            scheduledDate={full.occupancy.moveOutScheduledDate}
            isVacant={full.occupancy.status === "vacant"}
            onImmediateMoveOutComplete={scrollToMoveOutHistory}
          />
        ) : undefined}
      />
      <ContactSection value={contact} onChange={onContactChange} errors={{ phones: phoneError }} />
      <BillingSection value={billing} onChange={patch(setBilling)} />
      <UtilityCustomerSection value={utility} onChange={patch(setUtility)} customerOptions={customerOptions} />
      <BillStatementSection value={bill} alimtalkOptIn={contact.alimtalkOptIn} onChange={patch(setBill)} />
      <div
        ref={moveOutHistoryRef}
        className={`rounded-[14px] transition-shadow duration-300 ${moveOutHistoryHighlighted ? "shadow-[0_0_0_2px_var(--color-blue)]" : ""}`}
      >
        <MoveOutHistorySection history={full?.history ?? []} />
      </div>
      <LeaseInfoSection value={lease} onChange={patch(setLease)} />
      <PropertyInfoSection value={property} onChange={patch(setProperty)} />

      {unitId && (
        <div className="flex justify-center py-[4px]">
          <button
            type="button"
            onClick={async () => {
              // 확인창을 열 때 부과·수납 이력을 조회한다. 실패해도 삭제는 막지 않는다.
              const impact = await queryClient.fetchQuery(unitDeleteImpactQuery(unitId)).catch(() => null);
              const ok = await confirm({
                look: "plain",
                title: "호수 삭제",
                variant: "danger",
                description: `${deleteImpactWarning(impact, "호수")}정말 이 호수를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`,
                cancelLabel: "취소",
                confirmLabel: "삭제",
              });
              if (!ok) return;
              try {
                await del.mutateAsync(unitId);
                toast.success("삭제되었습니다.");
                router.push(`/staff/buildings?building=${buildingId}`);
              } catch (error) {
                toast.error(error, "삭제에 실패했습니다.");
              }
            }}
            disabled={del.isPending}
            className="flex h-[44px] w-full items-center justify-center rounded-[11px] border border-red bg-red text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {del.isPending ? "삭제 중…" : "호수 삭제"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {pageHeader}
      <div ref={formBodyRef} className="flex min-h-0 flex-1 flex-col gap-[29px] overflow-y-auto px-[24px] pb-[30px] pt-[22px]">
        {formContent}
      </div>
    </div>
  );
}
