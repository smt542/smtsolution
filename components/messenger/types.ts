export type ChannelMode = "sms" | "alim";
export type RecipientType = "staff" | "tenant" | "owner" | "cleaner";

export interface MessengerUiState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number } | null; // 드래그 위치(우하단 기준 offset). null=기본 위치
  channel: ChannelMode;
}
