import { ParishIdentity } from './ParishIdentity';
import { WelcomeQuote } from './WelcomeQuote';
import { General } from './General';
import { MassSchedule } from './MassSchedule';
import { WeeklyAssociation } from './WeeklyAssociation';
import { SanctuaryCandle } from './SanctuaryCandle';
import { AppPromo } from './AppPromo';

export { ParishIdentity, WelcomeQuote, General, MassSchedule, WeeklyAssociation, SanctuaryCandle, AppPromo };

export const templates = {
  parish_identity: {
    component: ParishIdentity,
    defaultDurationSec: 10,
    defaultWeight: 0.4,
    label: 'Parish Identity',
    description: 'Logo, parish name, and mission tagline on a navy background.',
  },
  welcome_quote: {
    component: WelcomeQuote,
    defaultDurationSec: 12,
    defaultWeight: 0.6,
    label: 'Welcome Quote',
    description: 'Scripture, Pope quote, or parish mission on a cream background.',
  },
  general: {
    component: General,
    defaultDurationSec: 18,
    defaultWeight: 1.0,
    label: 'General Announcement',
    description: 'Headline, body copy, optional meta line and background image.',
  },
  mass_schedule: {
    component: MassSchedule,
    defaultDurationSec: 20,
    defaultWeight: 1.5,
    label: 'Mass Schedule',
    description: 'Weekend or weekday Mass times with intentions. Paste-to-parse.',
  },
  weekly_association: {
    component: WeeklyAssociation,
    defaultDurationSec: 18,
    defaultWeight: 1.0,
    label: 'Weekly Mass Association',
    description: 'The names enrolled in this week\'s Mass Association.',
  },
  sanctuary_candle: {
    component: SanctuaryCandle,
    defaultDurationSec: 20,
    defaultWeight: 0.8,
    label: 'Sanctuary Candle',
    description: 'Animated candle with the name of the honored or remembered person.',
  },
  app_promo: {
    component: AppPromo,
    defaultDurationSec: 15,
    defaultWeight: 0.5,
    label: 'App Promo',
    description: 'Your Parish in Your Pocket — promotes the parish mobile app.',
  },
} as const;

export type TemplateKey = keyof typeof templates;
