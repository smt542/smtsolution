"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/common";
import { useAsyncAction } from "@/hooks/common";

import { partnerLoginClasses as styles } from "./loginClasses";
import { PartnerButton } from "../../_components/PartnerButton";

const AUTO_KEY = "erp_partner_login_auto";

export function PartnerLoginForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [auto, setAuto] = useState(false);
  const [err, setErr] = useState("");
  const loginAction = useAsyncAction();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_KEY);
      if (!saved) return;
      /* eslint-disable react-hooks/set-state-in-effect --
         자동 로그인 아이디는 클라이언트 전용 localStorage에서만 읽는다. SSR 하이드레이션
         불일치를 피하려고 초기값은 빈 값으로 두고 마운트 후 effect에서 프리필한다. */
      setAuto(true);
      setUsername(saved);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* localStorage 접근 불가 시 무시 */
    }
  }, []);

  const submit = async () => {
    if (loginAction.isPending) return;
    const id = username.trim();
    if (!id) {
      setErr("아이디를 입력해 주세요");
      return;
    }
    if (!password) {
      setErr("비밀번호를 입력해 주세요");
      return;
    }
    setErr("");
    try {
      await loginAction.run(async () => {
        const res = await fetch("/api/partner/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: id, password }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setErr(data.error ?? "로그인에 실패했습니다.");
          return;
        }
        try {
          if (auto) localStorage.setItem(AUTO_KEY, id);
          else localStorage.removeItem(AUTO_KEY);
        } catch {
          /* localStorage 접근 불가 시 무시 */
        }
        router.replace("/partner/mobile-home");
      });
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <>
      <div className={styles.form}>
        <div>
          <div className={styles.label}>아이디</div>
          <Input
            unstyled
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="아이디를 입력해 주세요"
            autoComplete="username"
            aria-label="아이디"
          />
        </div>

        <div>
          <div className={styles.label}>비밀번호</div>
          <div className={styles.pwWrap}>
            <Input
              unstyled
              className={styles.input}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              aria-label="비밀번호"
            />
            {/* 정본 #mlEye: 아이콘은 그대로, 켜면 색만 청록 */}
            <button
              type="button"
              className={`${styles.eye} ${showPw ? styles.eyeOn : styles.eyeOff}`}
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
                <circle cx="12" cy="12" r="2.8" />
              </svg>
            </button>
          </div>
        </div>

        {err && <div className={styles.err} role="alert">{err}</div>}

        <div
          className={styles.auto}
          onClick={() => setAuto((v) => !v)}
          role="checkbox"
          aria-checked={auto}
          tabIndex={0}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setAuto((v) => !v)}
        >
          <div className={`${styles.autoBox} ${auto ? styles.autoBoxOn : styles.autoBoxOff}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          </div>
          <div className={styles.autoLabel}>자동 로그인</div>
        </div>
      </div>

      <div className={styles.spacer} />

      <div className={styles.foot}>
        <PartnerButton variant="primary" size="login" type="button" className="disabled:cursor-default" onClick={submit} disabled={loginAction.isPending}>
          {loginAction.isPending ? "로그인 중…" : "로그인"}
        </PartnerButton>
        {children}
      </div>
    </>
  );
}
