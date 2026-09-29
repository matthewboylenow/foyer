import { EmailImport } from '@/components/admin/EmailImport';

export default function ImportPage() {
  const configured = !!process.env.ANTHROPIC_API_KEY;
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">This week&apos;s email</h1>
        <p className="mt-2 text-sm text-navy/55">
          Paste the Wednesday email blast and get one slide per announcement, copy exactly as
          written. Review, tick what goes on the screens, done.
        </p>
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
