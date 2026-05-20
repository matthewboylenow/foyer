import { parseWeekendMass } from '@/lib/parsers/weekendMass';
import { parseWeekdayMass } from '@/lib/parsers/weekdayMass';
import { parseWeeklyAssociation } from '@/lib/parsers/weeklyAssociation';
import { parseSanctuaryCandle } from '@/lib/parsers/sanctuaryCandle';

export async function POST(req: Request) {
  const { templateType, text } = await req.json();

  switch (templateType) {
    case 'mass_schedule_weekend':
      return Response.json(parseWeekendMass(text));
    case 'mass_schedule_weekday':
      return Response.json(parseWeekdayMass(text));
    case 'weekly_association':
      return Response.json(parseWeeklyAssociation(text));
    case 'sanctuary_candle':
      return Response.json(parseSanctuaryCandle(text));
    default:
      return Response.json({ error: 'Unknown template type' }, { status: 400 });
  }
}
