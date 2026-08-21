export function ArchiveMark() {
  return (
    <svg aria-hidden="true" className="archive-mark" viewBox="0 0 64 64">
      <path d="M15 12h25l9 9v31H15z" className="paper" />
      <path d="M40 12v10h9" className="fold" />
      <path d="M10 36h44v17a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5z" className="tray" />
      <path d="M24 43h16" className="slot" />
    </svg>
  );
}
