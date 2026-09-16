export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-[#e7eaee] font-sans text-t1 antialiased [--amber:#FF922B] [--amber-t:#FFF3E6] [--bg:#F2F4F6] [--blue:#14A497] [--blue-d:#0E8677] [--blue-t:#E2F5F1] [--blue-t2:#EFFBF8] [--kakao:#FEE500] [--kakao-t:#191600] [--line:#E8EBEE] [--line2:#F1F3F5] [--red:#F04452] [--red-t:#FDECEE] [--t1:#191F28] [--t2:#4E5968] [--t3:#8B95A1] [--t4:#B0B8C1]">
      <div className="relative flex h-dvh max-h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-white">{children}</div>
    </div>
  );
}
