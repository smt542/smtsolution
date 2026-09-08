interface A4LandscapeDocumentShellProps {
  testId: string;
  title: React.ReactNode;
  buildingName: string;
  children: React.ReactNode;
}

/**
 * Shared A4-landscape print document shell (277mm article + black-rule
 * header + footer) used by the receipts report print views. The header's
 * content (report label / title / subtitle) and the body (data table) stay
 * caller-specific and are passed in as `title` and `children`.
 */
export function A4LandscapeDocumentShell({
  testId,
  title,
  buildingName,
  children,
}: A4LandscapeDocumentShellProps) {
  return (
    <article
      className="mx-auto w-[277mm] bg-white p-[10mm] text-black"
      data-testid={testId}
    >
      <header className="mb-3 border-b-2 border-black pb-2">{title}</header>

      {children}

      <footer className="mt-3 border-t border-black pt-2 text-right text-[9px] font-bold">
        {buildingName}
      </footer>
    </article>
  );
}
