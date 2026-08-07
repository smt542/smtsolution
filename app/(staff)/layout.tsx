import { AuthBoot } from "@/components/AuthBoot";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (<><AuthBoot />{children}</>);
}
