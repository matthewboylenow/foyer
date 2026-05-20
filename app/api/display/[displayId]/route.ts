import { getEligibleSlides } from '@/lib/db/queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;

  try {
    const slides = await getEligibleSlides(displayId);
    return Response.json(slides, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Display API error:', err);
    return Response.json([], { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
