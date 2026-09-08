"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { ComplaintDialog } from "../ComplaintDialog";
import { FileDropzone } from "./FileDropzone";

interface GiroUploadModalProps {
  open: boolean;
  buildingId: number;
  period: string;
  onClose: () => void;
}

/**
 * 지로수납처리 — 은행에서 받은 지로 수납 TXT 파일 업로드(Figma).
 * 현재는 프론트 재현 단계: 파일을 읽어 행 수를 확인하고 안내한다.
 * TODO(backend): 지로 TXT 파싱·수납 반영 RPC 연동은 후속 작업.
 */
export function GiroUploadModal({ open, buildingId, period, onClose }: GiroUploadModalProps) {
  void buildingId;
  void period;
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    if (!file || processing) return;
    setProcessing(true);
    try {
      const text = await file.text();
      const count = text.split(/\r?\n/).filter((line) => line.trim()).length;
      toast.success(`지로 수납 파일을 확인했습니다. (${count.toLocaleString()}행)`);
      onClose();
    } catch {
      toast.error("지로 파일을 읽지 못했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ComplaintDialog
      open={open}
      onClose={onClose}
      title="지로수납처리"
      subtitle="은행에서 받은 지로 수납 파일을 첨부해 주세요"
      size="wide"
      footer={
        <div className="flex justify-end">
          <Button type="button" disabled={!file || processing} onClick={() => void handleProcess()}>
            {processing ? "처리 중…" : "처리"}
          </Button>
        </div>
      }
    >
      <FileDropzone
        accept=".txt"
        helperText="txt 파일만 첨부할 수 있어요"
        fileName={file?.name}
        disabled={processing}
        onFile={setFile}
        ariaLabel="지로 수납 파일 첨부"
      />
    </ComplaintDialog>
  );
}
