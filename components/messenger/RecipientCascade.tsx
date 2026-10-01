"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/common";
import { BUILDING_GROUP_TYPES, matchesBuildingGroup } from "@/lib/buildings/groupType";
import { useAccounts } from "@/hooks/reactquery/accounts/queries";
import { useBuildings } from "@/hooks/reactquery/buildings/queries";
import { useTenantList } from "@/hooks/reactquery/occupancies/queries";
import {
  dedupeRecipients,
  validRecipients,
  type MessageRecipient,
} from "@/lib/messaging/preset";
import type { RecipientCascadePreset } from "@/lib/messaging/messengerHandoff";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode, RecipientType } from "./types";

const TYPE_LABEL: Record<RecipientType, string> = {
  staff: "직원",
  tenant: "입주자",
  owner: "건물주",
  cleaner: "청소 담당자",
};

// 정본 GRP_OPTS — 건물 메뉴 '그룹 전체' 필터. 값은 건물 고지서 부과 그룹 유형(basic_extra.groupType, 미지정=1).
const GROUP_OPTIONS = [
  { value: "", label: "그룹 전체" },
  ...BUILDING_GROUP_TYPES.map((value) => ({ value, label: `그룹 ${value}` })),
];

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
      <Input
        unstyled
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
  preset,
  onChange,
}: {
  channel: ChannelMode;
  preset?: RecipientCascadePreset | null;
  onChange: (r: MessageRecipient[]) => void;
}) {
  const types: RecipientType[] =
    channel === "alim"
      ? ["tenant", "owner"]
      : ["staff", "tenant", "owner", "cleaner"];
  const [selection, setSelection] = useState(() =>
    preset && types.includes(preset.type)
      ? {
          ...EMPTY_SELECTION,
          type: preset.type,
          buildingId: preset.buildingId,
          tenantUnitIds: preset.unitIds,
        }
      : EMPTY_SELECTION,
  );
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [secondSearch, setSecondSearch] = useState("");
  const [thirdSearch, setThirdSearch] = useState("");
  const [buildingGroup, setBuildingGroup] = useState("");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  const thirdRef = useRef<HTMLDivElement>(null);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
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
  const selectedTenantUnitIds = useMemo(
    () =>
      selection.tenantUnitIds.filter((unitId) =>
        eligibleTenants.some((tenant) => tenant.unitId === unitId),
      ),
    [eligibleTenants, selection.tenantUnitIds],
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
  // 초기값을 빈 서명("")으로 둔다 — 마운트 직후 "선택 없음"을 부모로 통지하지 않기 위해서다.
  // null 로 두면 패널이 열릴 때마다 onChange([]) 가 한 번 나가, 화면에서 밀어 넣은 수신자
  // (openMessengerWith 핸드오프)를 캐스케이드가 곧바로 지워 버린다. 사용자가 실제로 골랐다가
  // 다시 비우는 전환은 서명이 ""로 "바뀌는" 것이라 그대로 통지된다.
  const lastEmittedSignatureRef = useRef<string | null>("");
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

  // 정본 grp-btn 클릭: 메뉴 오른쪽을 버튼 오른쪽에 맞추고(화면 8px 안), 아래가 모자라면 위로 연다.
  // 크기를 알아야 해서 그린 뒤 재어 바로 자리를 잡는다(건물 메뉴가 overflow:hidden 이라 fixed 로 띄운다).
  const groupMenuVisible = groupMenuOpen && openMenu === "second";
  useLayoutEffect(() => {
    const button = groupButtonRef.current;
    const menu = groupMenuRef.current;
    if (!groupMenuVisible || !button || !menu) return;
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth || 132;
    const height = menu.offsetHeight || 200;
    menu.style.left = `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`;
    menu.style.top = `${rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 5) : rect.bottom + 5}px`;
  }, [groupMenuVisible]);

  const toggleMenu = (
    menu: Exclude<OpenMenu, null>,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => {
    setGroupMenuOpen(false);
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
    setGroupMenuOpen(false);
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
        selectedTenantUnitIds.length === eligibleTenants.length
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
  const filteredBuildings = eligibleBuildings.filter(
    (building) =>
      matchesBuildingGroup(building, buildingGroup) &&
      `${building.code} ${building.name} ${building.address ?? ""}`
        .toLowerCase()
        .includes(normalizedSecondSearch),
  );
  const buildingGroupLabel =
    GROUP_OPTIONS.find((option) => option.value === buildingGroup)?.label ?? GROUP_OPTIONS[0].label;
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
    selectedTenantUnitIds.length === 0
      ? "입주자 선택"
      : selectedTenantUnitIds.length === eligibleTenants.length
        ? `전체 (${eligibleTenants.length}명)`
        : selectedTenantUnitIds.length === 1
          ? (() => {
              const tenant = eligibleTenants.find((candidate) =>
                selectedTenantUnitIds.includes(candidate.unitId),
              );
              return tenant
                ? `${tenant.unitNo} ${tenant.tenantName ?? ""}`.trim()
                : "입주자 1명";
            })()
          : `${eligibleTenants.find((tenant) => selectedTenantUnitIds.includes(tenant.unitId))?.tenantName ?? "입주자"} 외 ${selectedTenantUnitIds.length - 1}명`;
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
      className={`${styles["fmp-casc"]} ${useTwoColumns ? styles.two : styles.three}`}
    >
      <div
        ref={typeRef}
        className={`fmp-dd2 ${styles["fmp-dd2"]} ${styles["dd2-on"]} ${!type ? styles.ph : ""} ${openMenu === "type" ? styles.open : ""}`}
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
              className={`${styles.opt} ${styles["opt-plain"]} ${candidate === type ? `${styles.on} ${styles["opt-ck"]}` : ""}`}
              onClick={() => chooseType(candidate)}
            >
              {TYPE_LABEL[candidate]}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={secondRef}
        className={`fmp-dd2 ${styles["fmp-dd2"]} ${type ? styles["dd2-on"] : styles["dd2-off"]} ${type && ((type === "staff" && selection.staffIds.length === 0) || (type !== "staff" && !selectedBuilding)) ? styles.ph : ""} ${openMenu === "second" ? styles.open : ""}`}
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
          onClick={(event) => {
            event.stopPropagation();
            // 정본: 그룹 드롭다운 밖을 누르면 그룹 메뉴만 닫는다.
            if (!(event.target as HTMLElement).closest("[data-grp-dd]")) setGroupMenuOpen(false);
          }}
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
                  className={`${styles.opt} ${styles.chk} ${selection.staffIds.length === activeStaff.length ? styles["chk-on"] : styles["chk-off"]}`}
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
                    <span
                      className={`${styles.cbx} mt-px ${selection.staffIds.includes(account.userId) ? styles["cbx-on"] : styles["cbx-off"]}`}
                    />
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
              {/* 정본 fillBldMenu: 검색(.bsrch) 옆에 '그룹 전체' 드롭다운(.grp-dd) */}
              <div className={styles.ddsrch}>
                <div className={styles.bsrch}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3-3" />
                  </svg>
                  <Input
                    unstyled
                    value={secondSearch}
                    placeholder="건물명·주소 검색"
                    onChange={(event) => setSecondSearch(event.target.value)}
                  />
                </div>
                <div className={styles["grp-dd"]} data-grp-dd="">
                  <button
                    ref={groupButtonRef}
                    type="button"
                    className={`${styles["grp-btn"]} ${groupMenuVisible ? styles["grp-btn-on"] : styles["grp-btn-off"]}`}
                    aria-haspopup="listbox"
                    aria-expanded={groupMenuVisible}
                    onClick={() => setGroupMenuOpen((current) => !current)}
                  >
                    <span>{buildingGroupLabel}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {groupMenuVisible && (
                    <div ref={groupMenuRef} role="listbox" aria-label="건물 그룹" className={styles["grp-menu"]}>
                      {GROUP_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          role="option"
                          aria-selected={option.value === buildingGroup}
                          className={`${styles["grp-opt"]} ${option.value === buildingGroup ? styles["grp-opt-on"] : styles["grp-opt-off"]}`}
                          onClick={() => {
                            setBuildingGroup(option.value);
                            setGroupMenuOpen(false);
                          }}
                        >
                          {option.label}
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 12.5l5 5L20 6.5" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.ddopts}>
                {filteredBuildings.map((building) => (
                  <div
                    key={building.id}
                    className={`${styles.opt} ${styles["opt-plain"]} ${styles.bld} ${building.id === selection.buildingId ? `${styles.on} ${styles["opt-ck"]}` : ""}`}
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
          className={`fmp-dd2 ${styles["fmp-dd2"]} ${styles["dd2-on"]} ${selectedTenantUnitIds.length === 0 ? styles.ph : ""} ${openMenu === "third" ? styles.open : ""}`}
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
                className={`${styles.opt} ${styles.chk} ${selectedTenantUnitIds.length === eligibleTenants.length ? styles["chk-on"] : styles["chk-off"]}`}
                onClick={toggleAllTenants}
              >
                전체 ({eligibleTenants.length}명)
              </div>
            )}
            <div className={styles.ddopts}>
              {filteredTenants.map((tenant) => (
                <div
                  key={tenant.unitId}
                  className={`${styles.opt} ${styles.tnl} ${selectedTenantUnitIds.includes(tenant.unitId) ? styles.on : ""}`}
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
                  <span
                    className={`${styles.cbx} ${selectedTenantUnitIds.includes(tenant.unitId) ? styles["cbx-on"] : styles["cbx-off"]}`}
                  />
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
        <div className={`fmp-auto ${styles["fmp-auto"]}`}>
          {/* 정본 .fmp-auto .nm/.rl/.tel 값을 직접 쓴다 — 공용 styles.nm/rl/tel 은
              다른 화면용이라 값이 달랐고(rl 은 w-16 고정폭이라 역할이 3줄로 접혔다),
              맵의 [&_.nm] 훅은 리터럴 클래스가 없어 매칭되지 않았다. 소비처가 여기뿐이다. */}
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-blue-d">{autoRecipient.name}</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-t3">{autoRecipient.role}</div>
          </div>
          <span className="ml-auto text-[12.5px] font-bold tabular-nums text-t2">
            {autoRecipient.phone}
          </span>
        </div>
      )}
    </div>
  );
}
