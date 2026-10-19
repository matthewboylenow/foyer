import { EmailImport } from '@/components/admin/EmailImport';

export default function ImportPage() {
  const configured = !!process.env.ANTHROPIC_API_KEY;
  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Email import</h1>
        {!configured && (
          <p className="mt-3 text-sm text-rust">
            ANTHROPIC_API_KEY is not set on the server, so reading the email will fail until it is.
          </p>
        )}
      </div>
      <EmailImport />
    </div>
  );
}
