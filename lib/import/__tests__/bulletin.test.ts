import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/auth/session', () => ({ logAudit: async () => {} }));
vi.mock('@/lib/publish', () => ({ publishPlaylist: async () => ({}) }));

import { parseParishSection, pickLatestBulletinUrl, splitWeekendLabelLine, bulletinDateFromUrl } from '../bulletin';

/** pdf.js reading order of the Mass intentions column, two real weeks. */
const NOV15 = `From Our Pastor
Msgr. Tom
M A S S I N T E N T I O N S
W E E K E N D O F N O V E M B E R 1 4 / 1 55:00pm - Margaret Mindnich
8:00am - Mary Devitt
10:00am - Robert Dries
12:00pm - Francesco Vacca
6:00pm - Albert Henry Lospinoso
D A I L Y M A S S
Nov 16 - Jack Anderson & Joe Salcito
Nov 17 - Heron Family (Liv. & Dec.)
Nov 18 - Gene Corcoran
Nov 19 - Richard Henderson
Nov 20 - People of the Parish
Nov 21 - Joseph Esmerado
W E E K L Y M A S S A S S O C I A T I O N
Karla Magdalena Gamero, Thomas
Conheeney, Mary Patricia Bullack, Erasmo
Riccobono, Rosalind Seca, Antoinette
Savage, Jeffrey Pettit
S A N C T U A R Y C A N D L E
Clare Prime
W E ' R E S O G L A D Y O U ' R E H E R E
Text CONNECT to 908-860-8444 for a virtual
connect card, or stop by the Parish Center. We
would love to know your name.
W A Y S T O G I V EOnline
sainthelen.org/give`;

const NOV8 = `M A S S I N T E N T I O N S
W E E K E N D O F N O V E M B E R 7 / 85:00pm - Mary & Joseph Passananti
8:00am - Darius de Leon
10:00am - Raymond Fritschy, Sr.
12:00pm - Rose & Joseph Vancio
6:00pm - Jerry Collins
D A I L Y M A S S
Nov 9 - Mary Lehane
Nov 10 - People of the Parish
Nov 11 - Gerard Gallagher
Nov 12 - Patricia A. Brade
Nov 13 - Noll & Barone Families
Nov 14 - Patricia Nolan
W E E K L Y M A S S A S S O C I A T I O N
Michael Maiullo, Maureen Caulfield
McFarlin, Ken Killeen, Peter Saad, Vera
O'Keefe, Tom Conheeney, Anthony Mazza
S A N C T U A R Y C A N D L E
Margaret Briggs
W E ' R E S O G L A D Y O U ' R E H E R E
Text CONNECT to 908-860-8444 for a virtual`;

describe('parseParishSection', () => {
  it('reads the November 15 bulletin column', () => {
    const r = parseParishSection(NOV15);
    expect(r.found).toBe(true);
    expect(r.weekendLabel).toBe('Weekend of November 14 / 15');
    expect(r.weekendRows).toEqual([
      { timeLabel: '5:00PM', intention: 'Margaret Mindnich' },
      { timeLabel: '8:00AM', intention: 'Mary Devitt' },
      { timeLabel: '10:00AM', intention: 'Robert Dries' },
      { timeLabel: '12:00PM', intention: 'Francesco Vacca' },
      { timeLabel: '6:00PM', intention: 'Albert Henry Lospinoso' },
    ]);
    expect(r.weekdayRows).toHaveLength(6);
    expect(r.weekdayRows[0]).toEqual({ timeLabel: 'Nov 16', intention: 'Jack Anderson & Joe Salcito' });
    expect(r.weekdayRows[1].intention).toBe('Heron Family (Liv. & Dec.)');
    expect(r.associationNames).toEqual([
      'Karla Magdalena Gamero', 'Thomas Conheeney', 'Mary Patricia Bullack', 'Erasmo Riccobono',
      'Rosalind Seca', 'Antoinette Savage', 'Jeffrey Pettit',
    ]);
    expect(r.candle).toEqual({ name: 'Clare Prime', inMemoryOf: true });
    expect(r.warnings).toEqual([]);
  });

  it('reads the November 8 bulletin column (single-digit day, glued row)', () => {
    const r = parseParishSection(NOV8);
    expect(r.weekendLabel).toBe('Weekend of November 7 / 8');
    expect(r.weekendRows[0]).toEqual({ timeLabel: '5:00PM', intention: 'Mary & Joseph Passananti' });
    expect(r.weekendRows).toHaveLength(5);
    expect(r.weekdayRows.map((x) => x.timeLabel)).toEqual(['Nov 9', 'Nov 10', 'Nov 11', 'Nov 12', 'Nov 13', 'Nov 14']);
    expect(r.associationNames).toHaveLength(7);
    expect(r.associationNames[1]).toBe('Maureen Caulfield McFarlin');
    expect(r.candle).toEqual({ name: 'Margaret Briggs', inMemoryOf: true });
    expect(r.warnings).toEqual([]);
  });

  it('handles a candle "in honor of" and a label on its own line', () => {
    const r = parseParishSection(`M A S S I N T E N T I O N S
W E E K E N D O F N O V E M B E R 2 8 / 2 9
5:00pm - Someone
D A I L Y M A S S
Nov 30 - Someone Else
W E E K L Y M A S S A S S O C I A T I O N
A B and C D
S A N C T U A R Y C A N D L E
In honor of Jane Doe
N E X T H E A D I N G`);
    expect(r.weekendLabel).toBe('Weekend of November 28 / 29');
    expect(r.weekendRows).toEqual([{ timeLabel: '5:00PM', intention: 'Someone' }]);
    expect(r.associationNames).toEqual(['A B', 'C D']);
    expect(r.candle).toEqual({ name: 'Jane Doe', inMemoryOf: false });
  });

  it('reports when the column is missing', () => {
    const r = parseParishSection('Nothing here.');
    expect(r.found).toBe(false);
    expect(r.warnings[0]).toMatch(/Mass Intentions/);
  });
});

describe('splitWeekendLabelLine', () => {
  it('separates a glued first row from the label', () => {
    expect(splitWeekendLabelLine('W E E K E N D O F N O V E M B E R 1 4 / 1 55:00pm - Margaret Mindnich')).toEqual({
      label: 'WEEKENDOFNOVEMBER14/15',
      rest: '5:00pm - Margaret Mindnich',
    });
    expect(splitWeekendLabelLine('W E E K E N D O F D E C E M B E R 5 / 6')).toEqual({ label: 'WEEKENDOFDECEMBER5/6', rest: '' });
  });
});

describe('pickLatestBulletinUrl', () => {
  it('picks the newest dated PDF from the bulletin page', () => {
    const html = `
      <a href="https://sainthelen.org/wp-content/uploads/2026/11/Saint-Helen-Bulletin-11082026.pdf">old</a>
      <a class="sh-bul__cta" href="https://sainthelen.org/wp-content/uploads/2026/11/Saint-Helen-Bulletin-11152026.pdf">latest</a>
      <a href="/wp-content/uploads/2026/10/Saint-Helen-Bulletin-10252026.pdf">older</a>
      <a href="/wp-content/uploads/2019/05/Harrassement-Policy.pdf">policy</a>`;
    expect(pickLatestBulletinUrl(html)).toBe('https://sainthelen.org/wp-content/uploads/2026/11/Saint-Helen-Bulletin-11152026.pdf');
    expect(bulletinDateFromUrl(pickLatestBulletinUrl(html)!)).toBe('2026-11-15');
  });
  it('falls back to the featured link when filenames carry no date', () => {
    expect(pickLatestBulletinUrl('<a class="sh-bul__cta" href="/files/this-week.pdf">x</a>')).toBe('https://sainthelen.org/files/this-week.pdf');
    expect(pickLatestBulletinUrl('<p>nothing</p>')).toBeNull();
  });
});
