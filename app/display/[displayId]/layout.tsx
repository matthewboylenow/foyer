export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black overflow-hidden cursor-none">
      {children}
    </div>
  );
}
