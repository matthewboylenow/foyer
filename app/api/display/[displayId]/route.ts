import { getEligibleSlides, getDisplayById } from '@/lib/db/queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;

  try {
    const [display, slides] = await Promise.all([
      getDisplayById(displayId),
      getEligibleSlides(displayId),
    ]);
    const orientation = display?.orientation === 'landscape' ? 'landscape' : 'portrait';
    return Response.json(
      { orientation, slides },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('Display API error:', err);
    return Response.json(
      { orientation: 'portrait', slides: [] },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
