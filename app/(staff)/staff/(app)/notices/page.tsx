import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { NoticesServerError } from "./components/NoticesServerError";
import { NoticesWorkspace } from "./components/NoticesWorkspace";

export default async function NoticesPage() {
  let me: Awaited<ReturnType<typeof getStaffContext>>;
  try {
    me = await getStaffContext();
  } catch {
    return <NoticesServerError />;
  }

  if (!me || !hasModule(me, "notices")) {
    return <div className="p-6"><EmptyState message="공지 관리 권한이 없습니다." /></div>;
  }

  return (
    <NoticesWorkspace
      orgId={me.orgId}
      canSendMessages={hasModule(me, "messaging")}
    />
  );
}
