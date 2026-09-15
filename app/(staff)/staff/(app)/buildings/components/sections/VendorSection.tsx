"use client";
import React from "react";
import { Input, Select, Button, PhotoUpload } from "@/components/common";

export interface VendorExisting { id: number; path: string; name: string; }
export interface VendorRow {
  _key: string;
  id?: number;
  vendorType: "elevator" | "fire" | "electric" | "septic" | "etc";
  name: string;
  phone: string;
  memo: string;
  _deleted?: boolean;
  pendingFiles: File[];
  existing: VendorExisting[];
}
export const VENDOR_TYPE_LABELS: Record<VendorRow["vendorType"], string> = {
  elevator: "승강기", fire: "소방안전", electric: "전기안전", septic: "정화조", etc: "기타",
};
const TYPE_OPTS = (Object.keys(VENDOR_TYPE_LABELS) as VendorRow["vendorType"][]).map((k) => ({ value: k, label: VENDOR_TYPE_LABELS[k] }));

let seq = 0;
const newKey = () => `vn-new-${seq++}`;

export function VendorSection({
  rows, onChange, onDeleteExisting, onViewExisting, disabled = false,
}: {
  rows: VendorRow[];
  onChange: (rows: VendorRow[]) => void;
  onDeleteExisting: (attId: number, path: string) => void;
  onViewExisting: (path: string) => void;
  disabled?: boolean;
}) {
  const visible = rows.filter((r) => !r._deleted);
  const patch = (key: string, p: Partial<VendorRow>) => onChange(rows.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const add = () => onChange([...rows, { _key: newKey(), vendorType: "elevator", name: "", phone: "", memo: "", pendingFiles: [], existing: [] }]);
  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    if (row?.id) onChange(rows.map((r) => (r._key === key ? { ...r, _deleted: true } : r)));
    else onChange(rows.filter((r) => r._key !== key));
  };
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">협력업체</h2>
        <Button variant="ghost" onClick={add} disabled={disabled}>+ 협력업체 추가</Button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-t4">등록된 협력업체가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((r) => (
            <div key={r._key} className="rounded-xl border border-line p-4">
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2"><Select aria-label="유형" options={TYPE_OPTS} value={r.vendorType} onChange={(e) => patch(r._key, { vendorType: e.target.value as VendorRow["vendorType"] })} /></div>
                <div className="col-span-3"><Input aria-label="업체명" value={r.name} onChange={(e) => patch(r._key, { name: e.target.value })} placeholder="업체명" /></div>
                <div className="col-span-3"><Input aria-label="전화" value={r.phone} onChange={(e) => patch(r._key, { phone: e.target.value })} placeholder="전화(선택)" /></div>
                <div className="col-span-3"><Input aria-label="비고" value={r.memo} onChange={(e) => patch(r._key, { memo: e.target.value })} placeholder="비고(선택)" /></div>
                <div className="col-span-1"><Button variant="danger" onClick={() => remove(r._key)} disabled={disabled}>삭제</Button></div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {r.existing.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {r.existing.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-sm text-t2">
                        <button
                          type="button"
                          aria-label={`${f.name} 원본 보기`}
                          className="truncate text-left text-brand hover:underline"
                          onClick={() => onViewExisting(f.path)}
                        >
                          {f.name}
                        </button>
                        <button type="button" className="text-danger" disabled={disabled} onClick={() => onDeleteExisting(f.id, f.path)}>삭제</button>
                      </li>
                    ))}
                  </ul>
                )}
                <PhotoUpload
                  label="계약서 사진"
                  files={r.pendingFiles}
                  onFilesChange={(pendingFiles) => patch(r._key, { pendingFiles })}
                  max={Math.max(0, 10 - r.existing.length)}
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
