"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccounts } from "@/hooks/reactquery/accounts/queries";
import { useBuildings } from "@/hooks/reactquery/buildings/queries";
import { useTenantList } from "@/hooks/reactquery/occupancies/queries";
import {
  dedupeRecipients,
  validRecipients,
  type MessageRecipient,
} from "@/lib/messaging/preset";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode, RecipientType } from "./types";

const TYPE_LABEL: Record<RecipientType, string> = {
  staff: "직원",
  tenant: "입주자",
  owner: "건물주",
  cleaner: "청소 담당자",
};

const EMPTY_SELECTION = {
  type: "" as RecipientType | "",
  buildingId: null as number | null,
  staffIds: [] as string[],
  tenantUnitIds: [] as number[],
};

type OpenMenu = "type" | "second" | "third" | null;

interface MenuPosition {
  left: number;
  top: number;
  width: number;
}

function hasPhone(phone: string | null | undefined): phone is string {
  return !!phone?.replace(/\D/g, "");
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function Chevron() {
  return (
    <svg
      className={`cv ${styles.cv}`}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="#8B95A1"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SearchField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.ddsrch}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

export function RecipientCascade({
  channel,
  onChange,
}: {
  channel: ChannelMode;
  onChange: (r: MessageRecipient[]) => void;
}) {
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [secondSearch, setSecondSearch] = useState("");
  const [thirdSearch, setThirdSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  const thirdRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  // 채널(문자↔알림톡) 전환 시 선택 조정 — effect가 아닌 렌더 중 조정(React 권장 패턴).
  // 새 채널에 없는 유형만 초기화한다: 입주자·건물주는 두 채널 공통이라 선택을 유지해
  // 문자↔알림톡을 오가도 수신자 선택이 보존되고, 직원·청소담당은 알림톡에 없어 초기화된다.
  const [prevChannel, setPrevChannel] = useState(channel);
  if (channel !== prevChannel) {
    setPrevChannel(channel);
    const validTypes: RecipientType[] =
      channel === "alim"
        ? ["tenant", "owner"]
        : ["staff", "tenant", "owner", "cleaner"];
    if (selection.type && !validTypes.includes(selection.type as RecipientType)) {
      setSelection(EMPTY_SELECTION);
    }
    setOpenMenu(null);
    setSecondSearch("");
    setThirdSearch("");
  }

  const types: RecipientType[] =
    channel === "alim"
      ? ["tenant", "owner"]
      : ["staff", "tenant", "owner", "cleaner"];
  const type = types.includes(selection.type as RecipientType)
    ? selection.type
    : "";

  const { data: buildings = [] } = useBuildings();
  const { data: accounts = [] } = useAccounts();
  const { data: tenants = [] } = useTenantList(
    type === "tenant" && selection.buildingId ? selection.buildingId : 0,
  );

  const activeStaff = useMemo(
    () => accounts.filter((account) => account.isActive && hasPhone(account.phone)),
    [accounts],
  );
  const eligibleTenants = useMemo(
    () => tenants.filter((tenant) => !tenant.isVacant && hasPhone(tenant.phone)),
    [tenants],
  );
  const cleanerByBuildingId = useMemo(
    () =>
      new Map(
        buildings.flatMap((building) => {
          const cleaner = building.cleaningUserId
            ? accounts.find((account) => account.userId === building.cleaningUserId)
            : undefined;
          return cleaner && hasPhone(cleaner.phone)
            ? ([[building.id, cleaner]] as const)
            : [];
        }),
      ),
    [accounts, buildings],
  );
  const eligibleBuildings = useMemo(() => {
    if (type === "owner") {
      return buildings.filter((building) => hasPhone(building.ownerPhone));
    }
    if (type === "cleaner") {
      return buildings.filter((building) => cleanerByBuildingId.has(building.id));
    }
    return buildings;
  }, [buildings, cleanerByBuildingId, type]);
  const selectedBuilding = buildings.find(
    (building) => building.id === selection.buildingId,
  );
  const selectedCleaner = selectedBuilding
    ? cleanerByBuildingId.get(selectedBuilding.id)
    : undefined;

  const selectedRecipients = useMemo<MessageRecipient[]>(() => {
    if (type === "staff") {
      return activeStaff
        .filter((account) => selection.staffIds.includes(account.userId))
        .map((account) => ({
          name: account.fullName,
          phone: account.phone,
          kind: "staff",
          ref: { userId: account.userId },
        }));
    }

    if (type === "tenant") {
      return eligibleTenants
        .filter((tenant) => selection.tenantUnitIds.includes(tenant.unitId))
        .map((tenant) => ({
          name: tenant.tenantName,
          phone: tenant.phone,
          unitNo: tenant.unitNo,
          kind: "tenant",
          ref: {
            occupancyId: tenant.occupancyId ?? undefined,
            buildingId: selection.buildingId ?? undefined,
          },
        }));
    }

    if (type === "owner" && selectedBuilding) {
      return [
        {
          name: selectedBuilding.ownerName,
          phone: selectedBuilding.ownerPhone,
          kind: "owner",
          ref: { buildingId: selectedBuilding.id },
        },
      ];
    }

    if (type === "cleaner" && selectedBuilding && selectedCleaner) {
      return [
        {
          name: selectedCleaner.fullName,
          phone: selectedCleaner.phone,
          kind: "cleaner",
          ref: {
            userId: selectedCleaner.userId,
            buildingId: selectedBuilding.id,
          },
        },
      ];
    }

    return [];
  }, [
    activeStaff,
    eligibleTenants,
    selectedBuilding,
    selectedCleaner,
    selection.buildingId,
    selection.staffIds,
    selection.tenantUnitIds,
    type,
  ]);
  const emittedRecipients = useMemo(
    () => validRecipients(dedupeRecipients(selectedRecipients)),
    [selectedRecipients],
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // emittedRecipients는 쿼리 로딩 중 기본값(data = [])이나 파생 memo 때문에 매 렌더 새 배열
  // 참조가 되기 쉽다. 그러면 내용이 같아도 이 effect가 매 렌더 부모 onChange(setRecipients)를
  // 호출해 무한 렌더 루프("Maximum update depth")가 난다. 내용 서명이 실제로 바뀔 때만 통지한다.
  const lastEmittedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const signature = emittedRecipients.map((r) => `${r.kind}:${r.phone}`).join("|");
    if (signature === lastEmittedSignatureRef.current) return;
    lastEmittedSignatureRef.current = signature;
    onChangeRef.current(emittedRecipients);
  }, [emittedRecipients]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const toggleMenu = (
    menu: Exclude<OpenMenu, null>,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => {
    if (openMenu === menu) {
      setOpenMenu(null);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width });
    }
    setOpenMenu(menu);
  };

  const chooseType = (nextType: RecipientType) => {
    setSelection({ ...EMPTY_SELECTION, type: nextType });
    setSecondSearch("");
    setThirdSearch("");
    setOpenMenu(null);
  };

  const chooseBuilding = (buildingId: number) => {
    setSelection((current) => ({
      ...current,
      buildingId,
      tenantUnitIds: [],
    }));
    setThirdSearch("");
    setOpenMenu(null);
  };

  const toggleAllStaff = () => {
    setSelection((current) => ({
      ...current,
      staffIds:
        current.staffIds.length === activeStaff.length
          ? []
          : activeStaff.map((account) => account.userId),
    }));
  };

  const toggleAllTenants = () => {
    setSelection((current) => ({
      ...current,
      tenantUnitIds:
        current.tenantUnitIds.length === eligibleTenants.length
          ? []
          : eligibleTenants.map((tenant) => tenant.unitId),
    }));
  };

  const normalizedSecondSearch = secondSearch.trim().toLowerCase();
  const filteredStaff = activeStaff.filter((account) =>
    `${account.fullName} ${account.roleLabels.join(" ")} ${account.phone}`
      .toLowerCase()
      .includes(normalizedSecondSearch),
  );
  const filteredBuildings = eligibleBuildings.filter((building) =>
    `${building.code} ${building.name} ${building.address ?? ""}`
      .toLowerCase()
      .includes(normalizedSecondSearch),
  );
  const normalizedThirdSearch = thirdSearch.trim().toLowerCase();
  const filteredTenants = eligibleTenants.filter((tenant) =>
    `${tenant.unitNo} ${tenant.tenantName ?? ""} ${tenant.phone}`
      .toLowerCase()
      .includes(normalizedThirdSearch),
  );

  const staffSelectionLabel =
    selection.staffIds.length === 0
      ? "직원 선택"
      : selection.staffIds.length === activeStaff.length
        ? `전체 (${activeStaff.length}명)`
        : selection.staffIds.length === 1
          ? (activeStaff.find((account) =>
              selection.staffIds.includes(account.userId),
            )?.fullName ?? "직원 1명")
          : `${activeStaff.find((account) => selection.staffIds.includes(account.userId))?.fullName ?? "직원"} 외 ${selection.staffIds.length - 1}명`;
  const tenantSelectionLabel =
    selection.tenantUnitIds.length === 0
      ? "입주자 선택"
      : selection.tenantUnitIds.length === eligibleTenants.length
        ? `전체 (${eligibleTenants.length}명)`
        : selection.tenantUnitIds.length === 1
          ? (() => {
              const tenant = eligibleTenants.find((candidate) =>
                selection.tenantUnitIds.includes(candidate.unitId),
              );
              return tenant
                ? `${tenant.unitNo} ${tenant.tenantName ?? ""}`.trim()
                : "입주자 1명";
            })()
          : `${eligibleTenants.find((tenant) => selection.tenantUnitIds.includes(tenant.unitId))?.tenantName ?? "입주자"} 외 ${selection.tenantUnitIds.length - 1}명`;
  const menuStyle = menuPosition ?? undefined;
  const autoRecipient =
    type === "owner" && selectedBuilding
      ? {
          name: selectedBuilding.ownerName ?? "건물주",
          role: `${selectedBuilding.name} 건물주`,
          phone: selectedBuilding.ownerPhone,
        }
      : type === "cleaner" && selectedBuilding && selectedCleaner
        ? {
            name: selectedCleaner.fullName,
            role: `${selectedBuilding.name} 청소 담당`,
            phone: selectedCleaner.phone,
          }
        : null;
  // 정본(Messenger.dc.html L534·995): 기본(미선택) 상태와 staff/owner/cleaner는 2열(.two, flex:1 1 0),
  // tenant+건물/자동수신(3요소)일 때만 .two 해제(각 1/3). 미선택 기본상태 누락 시 좌측 1/3 폭으로 쏠린다.
  const useTwoColumns =
    !type || type === "staff" || ((type === "owner" || type === "cleaner") && !autoRecipient);

  return (
    <div
      ref={rootRef}
      className={`${styles["fmp-casc"]} ${useTwoColumns ? styles.two : ""}`}
    >
      <div
        ref={typeRef}
        className={`fmp-dd2 ${styles["fmp-dd2"]} ${!type ? styles.ph : ""} ${openMenu === "type" ? styles.open : ""}`}
        onClick={() => toggleMenu("type", typeRef)}
        aria-expanded={openMenu === "type"}
      >
        <span className={`v ${styles.v}`}>{type ? TYPE_LABEL[type] : "유형 선택"}</span>
        <Chevron />
        <div
          className="menu"
          style={openMenu === "type" ? { ...menuStyle, display: "flex" } : { display: "none" }}
          onClick={(event) => event.stopPropagation()}
        >
          {types.map((candidate) => (
            <div
              key={candidate}
              className={`${styles.opt} ${candidate === type ? styles.on : ""}`}
              onClick={() => chooseType(candidate)}
            >
              {TYPE_LABEL[candidate]}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={secondRef}
        className={`fmp-dd2 ${styles["fmp-dd2"]} ${!type ? styles.disabled : ""} ${type && ((type === "staff" && selection.staffIds.length === 0) || (type !== "staff" && !selectedBuilding)) ? styles.ph : ""} ${openMenu === "second" ? styles.open : ""}`}
        onClick={() => type && toggleMenu("second", secondRef)}
        aria-expanded={openMenu === "second"}
      >
        <span className={`v ${styles.v}`}>
          {!type ? (
            "유형을 먼저 선택"
          ) : type === "staff" ? (
            staffSelectionLabel
          ) : selectedBuilding ? (
            <>
              <span className={styles.ocv}>{selectedBuilding.code}</span>
              {selectedBuilding.name}
            </>
          ) : (
            "건물 선택"
          )}
        </span>
        <Chevron />
        <div
          className="menu"
          style={openMenu === "second" ? { ...menuStyle, display: "flex" } : { display: "none" }}
          onClick={(event) => event.stopPropagation()}
        >
          {type === "staff" ? (
            <>
              <SearchField
                value={secondSearch}
                placeholder="이름 검색"
                onChange={setSecondSearch}
              />
              {activeStaff.length > 0 && (
                <div
                  className={`${styles.opt} ${styles.chk} ${selection.staffIds.length === activeStaff.length ? styles.on : ""}`}
                  onClick={toggleAllStaff}
                >
                  전체 ({activeStaff.length}명)
                </div>
              )}
              <div className={styles.ddopts}>
                {filteredStaff.map((account) => (
                  <div
                    key={account.userId}
                    className={`${styles.opt} ${styles.owl} ${selection.staffIds.includes(account.userId) ? styles.on : ""}`}
                    onClick={() =>
                      setSelection((current) => ({
                        ...current,
                        staffIds: toggleValue(current.staffIds, account.userId),
                      }))
                    }
                  >
                    <span className={styles.cbx} />
                    <div className={styles.owg}>
                      <div className={styles.owrow1}>
                        <span className={styles.ownm}>
                          {account.fullName}{" "}
                          <span className={styles.strole}>
                            ({account.roleLabels.join(", ") || "직원"})
                          </span>
                        </span>
                        <span className={styles.owtels}>{account.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredStaff.length === 0 && (
                  <div className={styles["fmp-pempty"]}>선택 가능한 직원이 없습니다.</div>
                )}
              </div>
            </>
          ) : (
            <>
              <SearchField
                value={secondSearch}
                placeholder="건물명·주소 검색"
                onChange={setSecondSearch}
              />
              <div className={styles.ddopts}>
                {filteredBuildings.map((building) => (
                  <div
                    key={building.id}
                    className={`${styles.opt} ${styles.bld} ${building.id === selection.buildingId ? styles.on : ""}`}
                    onClick={() => chooseBuilding(building.id)}
                  >
                    <span className={styles.oc}>{building.code}</span>
                    <div className={styles.btxt}>
                      <div className={styles.bnm}>{building.name}</div>
                      <div className={styles.badr}>{building.address ?? "주소 미등록"}</div>
                    </div>
                  </div>
                ))}
                {filteredBuildings.length === 0 && (
                  <div className={styles["fmp-pempty"]}>
                    전화번호가 등록된 대상이 없습니다.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {type === "tenant" && selectedBuilding && (
        <div
          ref={thirdRef}
          className={`fmp-dd2 ${styles["fmp-dd2"]} ${selection.tenantUnitIds.length === 0 ? styles.ph : ""} ${openMenu === "third" ? styles.open : ""}`}
          onClick={() => toggleMenu("third", thirdRef)}
          aria-expanded={openMenu === "third"}
        >
          <span className={`v ${styles.v}`}>{tenantSelectionLabel}</span>
          <Chevron />
          <div
            className="menu"
            style={openMenu === "third" ? { ...menuStyle, display: "flex" } : { display: "none" }}
            onClick={(event) => event.stopPropagation()}
          >
            <SearchField
              value={thirdSearch}
              placeholder="호수·이름 검색"
              onChange={setThirdSearch}
            />
            {eligibleTenants.length > 0 && (
              <div
                className={`${styles.opt} ${styles.chk} ${selection.tenantUnitIds.length === eligibleTenants.length ? styles.on : ""}`}
                onClick={toggleAllTenants}
              >
                전체 ({eligibleTenants.length}명)
              </div>
            )}
            <div className={styles.ddopts}>
              {filteredTenants.map((tenant) => (
                <div
                  key={tenant.unitId}
                  className={`${styles.opt} ${styles.tnl} ${selection.tenantUnitIds.includes(tenant.unitId) ? styles.on : ""}`}
                  onClick={() =>
                    setSelection((current) => ({
                      ...current,
                      tenantUnitIds: toggleValue(
                        current.tenantUnitIds,
                        tenant.unitId,
                      ),
                    }))
                  }
                >
                  <span className={styles.cbx} />
                  <span className={styles["ow-av"]}>
                    {(tenant.tenantName ?? tenant.unitNo).slice(0, 1)}
                  </span>
                  <span className={styles["tnl-nm"]}>
                    {tenant.tenantName ?? "이름 미등록"}
                  </span>
                  <span className={styles["tnl-ho"]}>{tenant.unitNo}</span>
                </div>
              ))}
              {filteredTenants.length === 0 && (
                <div className={styles["fmp-pempty"]}>
                  전화번호가 등록된 입주자가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {autoRecipient && (
        <div className={styles["fmp-auto"]}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.nm}>{autoRecipient.name}</div>
            <div className={styles.rl}>{autoRecipient.role}</div>
          </div>
          <span className={styles.tel}>{autoRecipient.phone}</span>
        </div>
      )}
    </div>
  );
}
