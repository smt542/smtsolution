"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Button, Select, Input, Modal } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useRepairsByBuilding, useCreateRepair, useUpdateRepair, useDeleteRepair,
  useRepairAttachments, useUploadRepairAttachment, useDeleteRepairAttachment,
  type LongTermRepair, type RepairAttachment,
} from "@/hooks/reactquery/longTermRepair";

function AttachmentLoader({ repairId, children }: {
  repairId: number;
  children: (d: { attachments: RepairAttachment[]; onUpload: (f: File) => Promise<void>; onDelete: (a: RepairAttachment) => Promise<void> }) => React.ReactNode;
}) {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: attachments = [] } = useRepairAttachments(repairId);
  const upload = useUploadRepairAttachment();
  const del = useDeleteRepairAttachment();
  const onUpload = async (file: File) => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try { await upload.mutateAsync({ repairId, orgId, file }); } catch (e: any) { toast.error(e.message ?? "업로드 실패"); }
  };
  const onDelete = async (a: RepairAttachment) => {
    try { await del.mutateAsync({ id: a.id, path: a.fileUrl, repairId }); } catch (e: any) { toast.error(e.message ?? "삭제 실패"); }
  };
  return <>{children({ attachments, onUpload, onDelete })}</>;
}

export function LongTermRepairTab() {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: buildings = [] } = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const { data: repairs = [] } = useRepairsByBuilding(buildingId ?? undefined);

  const create = useCreateRepair();
  const update = useUpdateRepair();
  const del = useDeleteRepair();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LongTermRepair | null>(null);
  const [workName, setWorkName] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const openCreate = () => { setEditing(null); setWorkName(""); setWorkDate(""); setAmount(""); setMemo(""); setOpen(true); };
  const openEdit = (r: LongTermRepair) => {
    setEditing(r); setWorkName(r.workName); setWorkDate(r.workDate ?? "");
    setAmount(r.amount != null ? String(r.amount) : ""); setMemo(r.memo ?? ""); setOpen(true);
  };

  const submit = async () => {
    if (!workName.trim()) { toast.error("공사명을 입력해 주세요"); return; }
    const payload = { workName, workDate: workDate || null, amount: amount === "" ? null : Number(amount), memo: memo || null };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: payload });
      else {
        if (!orgId || !buildingId) { toast.error("건물을 선택해 주세요"); return; }
        await create.mutateAsync({ orgId, buildingId, ...payload });
      }
      setOpen(false);
    } catch (e: any) { toast.error(e.message ?? "저장 실패"); }
  };
  const remove = async (id: number) => { try { await del.mutateAsync(id); } catch (e: any) { toast.error(e.message ?? "삭제 실패"); } };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <span className="text-sm text-t2">건물</span>
          <Select aria-label="건물 선택" value={buildingId != null ? String(buildingId) : ""}
            onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : null)}
            options={[{ value: "", label: "건물을 선택하세요" }, ...buildings.map((b) => ({ value: String(b.id), label: b.name }))]} />
        </label>
        <Button variant="primary" onClick={openCreate} disabled={!buildingId}>＋ 이력 추가</Button>
      </div>

      {!buildingId ? (
        <p className="text-sm text-t4">건물을 선택하면 장기수선비 이력이 표시됩니다.</p>
      ) : repairs.length === 0 ? (
        <p className="text-sm text-t4">등록된 이력이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {repairs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <span className="flex-1 text-sm text-t1">{r.workName}</span>
              <span className="text-sm text-t3">{r.workDate ?? "-"}</span>
              <span className="text-sm text-t2">{r.amount != null ? r.amount.toLocaleString() + "원" : "-"}</span>
              <button aria-label={`${r.workName} 수정`} onClick={() => openEdit(r)} className="text-xs text-t3 hover:text-brand">수정</button>
              <button aria-label={`${r.workName} 삭제`} onClick={() => remove(r.id)} className="text-xs text-t3 hover:text-danger">삭제</button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "장기수선비 수정" : "장기수선비 추가"}>
        <div className="flex flex-col gap-3">
          <Input aria-label="공사명" placeholder="공사명" value={workName} onChange={(e) => setWorkName(e.target.value)} />
          <Input aria-label="공사일" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          <Input aria-label="금액" type="number" placeholder="금액(원)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <textarea aria-label="비고" placeholder="비고" value={memo} onChange={(e) => setMemo(e.target.value)}
            className="min-h-20 w-full rounded-xl border border-line bg-surface p-3 text-sm text-t1" />
          {editing && (
            <AttachmentLoader repairId={editing.id}>
              {({ attachments, onUpload, onDelete }) => (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-t2">영수증·사진</span>
                  <input type="file" accept="image/*,application/pdf" aria-label="파일 업로드"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
                  <ul className="flex flex-col gap-1">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{a.fileName}</span>
                        <button aria-label={`${a.fileName} 삭제`} onClick={() => onDelete(a)} className="text-xs text-t3 hover:text-danger">삭제</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AttachmentLoader>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="text-sm text-t3">취소</button>
            <Button variant="primary" onClick={submit} disabled={create.isPending || update.isPending}>{editing ? "저장" : "추가"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
