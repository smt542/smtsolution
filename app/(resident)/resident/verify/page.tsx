"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  automatch,
  confirm,
  getActiveCandidate,
  getSession,
  requestClaim,
  searchBuildings,
  type Building,
  type Candidate,
} from "@/lib/resident/onboardingClient";

import styles from "./verify.module.css";

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;

  const index = text.toLowerCase().indexOf(query);
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <em>{text.slice(index, index + query.length)}</em>
      {text.slice(index + query.length)}
    </>
  );
}

export default function ResidentVerifyPage() {
  const router = useRouter();
  const buildingsRequest = useRef<Promise<Building[]> | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [buildings, setBuildings] = useState<Building[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );
  const [unitValue, setUnitValue] = useState("");

  useEffect(() => {
    if (!getSession()) {
      router.replace("/resident/login");
      return;
    }

    let cancelled = false;

    const resolveCandidate = async () => {
      const activeCandidate = getActiveCandidate();
      const matchedCandidate =
        activeCandidate ?? (await automatch()).at(0) ?? null;

      if (cancelled) return;

      if (!matchedCandidate) {
        router.replace("/resident/nomatch");
        return;
      }

      setCandidate(matchedCandidate);
    };

    void resolveCandidate();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleBuildings = (buildings ?? []).filter((building) =>
    `${building.name} ${building.address}`
      .toLowerCase()
      .includes(normalizedQuery),
  );

  const openSheet = () => {
    setStep(1);
    setQuery("");
    setSelectedBuilding(null);
    setUnitValue("");
    setSheetOpen(true);

    if (!buildingsRequest.current) {
      buildingsRequest.current = searchBuildings("");
      void buildingsRequest.current.then(setBuildings);
    }
  };

  const confirmHousehold = async () => {
    if (!candidate) return;

    await confirm(candidate.occupancyId);
    router.push("/resident/notify");
  };

  const requestUnitClaim = async () => {
    if (!selectedBuilding || !unitValue) return;

    await requestClaim({
      buildingId: selectedBuilding.id,
      unitText: unitValue,
      buildingName: selectedBuilding.name,
    });
    router.push("/resident/pending");
  };

  if (!candidate) return null;

  return (
    <>
      <div className={styles.hdr}>
        <button
          type="button"
          className={styles.bk}
          aria-label="Back"
          onClick={() => router.push("/resident/login")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>
      <div className={styles.body}>
        <h1 className={styles.h1}>이 세대가 맞나요?</h1>
        <p className={styles.lead}>
          카카오에 등록된 연락처로 찾은 세대예요.
          <br />
          확인하면 관리비 내역을 바로 볼 수 있어요.
        </p>
        <div className={styles.card}>
          <div className={styles.who}>
            <div className={styles.ava}>
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                <path d="M3 21h18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
              </svg>
            </div>
            <div>
              <b>{candidate.buildingName}</b>
              <span className={styles.num}>{candidate.unitNo}</span>
            </div>
          </div>
        </div>
        <div className={styles.hint}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v.5M12 11.5v5" />
          </svg>
          세대 정보는 관리사무소에 등록된 자료를 기준으로 확인해요.
        </div>
      </div>
      <div className={styles.foot}>
        <button
          id="rvOk"
          type="button"
          className={`${styles.btn} ${styles.pri}`}
          onClick={confirmHousehold}
        >
          네, 맞아요
        </button>
        <button
          id="rvNo"
          type="button"
          className={`${styles.btn} ${styles.alt}`}
          onClick={openSheet}
        >
          제 세대가 아니에요
        </button>
      </div>

      <div
        id="rvSheet"
        className={`${styles.sheet} ${sheetOpen ? styles.show : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSheetOpen(false);
          }
        }}
      >
        <div className={styles.sheetB}>
          <div className={styles.grab} />
          <div className={styles.shd}>
            <button
              id="rvBack"
              type="button"
              className={styles.sback}
              aria-label="Back"
              style={{ display: step === 1 ? "none" : "flex" }}
              onClick={() => setStep(1)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div className={styles.sheetHeading}>
              <div id="rvST" className={styles.sheetT}>
                {step === 1 ? "어느 건물에 사시나요?" : "호수를 입력해 주세요"}
              </div>
              <div id="rvSD" className={styles.sheetD}>
                {step === 1
                  ? "건물명 또는 주소로 검색해 보세요"
                  : "관리사무소 확인 후 세대를 연결해 드려요"}
              </div>
            </div>
            <div id="rvStep" className={styles.stepno}>
              {step} / 2
            </div>
          </div>

          {step === 1 ? (
            <div id="rvS1" className={styles.stepOne}>
              <div className={styles.srch}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" />
                </svg>
                <input
                  id="rvQ"
                  value={query}
                  placeholder="예: 그린빌라 · 봉명동"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    id="rvClear"
                    type="button"
                    className={styles.sclear}
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {buildings !== null && visibleBuildings.length > 0 && (
                <>
                  <div id="rvCnt" className={styles.cnt}>
                    {normalizedQuery
                      ? `${visibleBuildings.length}개 건물`
                      : `관리 중인 건물 ${buildings.length}개`}
                  </div>
                  <div id="rvList" className={styles.list}>
                    {visibleBuildings.map((building) => (
                      <button
                        type="button"
                        className={styles.opt}
                        key={building.id}
                        onClick={() => {
                          setSelectedBuilding(building);
                          setUnitValue("");
                          setStep(2);
                        }}
                      >
                        <div className={styles.optionText}>
                          <b>{highlightMatch(building.name, normalizedQuery)}</b>
                          <span>
                            {highlightMatch(building.address, normalizedQuery)}
                          </span>
                        </div>
                        <svg
                          className={styles.ck}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 12.5l5 5L20 6.5" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {buildings !== null && visibleBuildings.length === 0 && (
                <div id="rvEmpty" className={styles.empty}>
                  <b>검색 결과가 없어요</b>
                  <span>
                    건물명이 정확하지 않아도 괜찮아요.
                    <br />동 이름이나 주소 일부로 다시 찾아보세요.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div id="rvS2" className={styles.stepTwo}>
              <div id="rvPicked" className={styles.picked}>
                <div className={styles.pickedText}>
                  <b>{selectedBuilding?.name}</b>
                  <span>{selectedBuilding?.address}</span>
                </div>
              </div>
              <input
                id="rvUnit"
                className={styles.fin}
                value={unitValue}
                inputMode="numeric"
                placeholder="호수 입력 (예: 201)"
                onChange={(event) =>
                  setUnitValue(
                    event.target.value.replace(/[^0-9]/g, "").slice(0, 5),
                  )
                }
              />
              <div className={styles.uhint}>
                숫자만 입력해 주세요. 예) 지하 1층 101호 → B101은 관리사무소 확인이 필요해요.
              </div>
              <button
                id="rvReq"
                type="button"
                className={styles.sbtn}
                disabled={!selectedBuilding || !unitValue}
                onClick={requestUnitClaim}
              >
                확인 요청하기
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
