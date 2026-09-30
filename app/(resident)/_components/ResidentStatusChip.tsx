type ResidentStatusChipProps = {
  paid: boolean;
  className?: string;
};

export default function ResidentStatusChip({
  paid,
  className,
}: ResidentStatusChipProps) {
  return (
    <span
      className={`flex-none rounded-lg px-[9px] py-1 text-[11.5px] font-extrabold leading-[normal] ${paid ? "bg-blue-t text-blue-d" : "bg-red-t text-red"}${className ? ` ${className}` : ""}`}
    >
      {paid ? "완납" : "미납"}
    </span>
  );
}
