export interface TallyTheme {
  id: string;
  name: string;
  description: string;
  emojis: [string, string, string, string];
}

export const TALLY_THEMES: TallyTheme[] = [
  {
    id: 'growing_tree',
    name: 'Growing Tree',
    description: 'Seed to mighty tree',
    emojis: ['🌰', '🌱', '🌿', '🌳'],
  },
  {
    id: 'flower_bloom',
    name: 'Flower Bloom',
    description: 'Sprout to cherry blossom',
    emojis: ['🌱', '🌼', '🌷', '🌸'],
  },
  {
    id: 'study_time',
    name: 'Study Time',
    description: 'Books to graduation',
    emojis: ['📚', '✏️', '📝', '🎓'],
  },
  {
    id: 'space_voyage',
    name: 'Going To Space',
    description: 'Astronaut to cosmos',
    emojis: ['🧑‍🚀', '🚀', '🌙', '🪐'],
  },
  {
    id: 'cafe_vibes',
    name: 'Cafe Vibes',
    description: 'Coffee to sweet bakery',
    emojis: ['☕', '🥐', '🧋', '🍰'],
  },
  {
    id: 'rain_rainbow',
    name: 'Rain to Rainbow',
    description: 'Storm into rainbow',
    emojis: ['🌧️', '⛈️', '🌤️', '🌈'],
  },
  {
    id: 'beach_vacay',
    name: 'Beach Vacation',
    description: 'Coast to sunset',
    emojis: ['🏖️', '🌊', '🐚', '🌅'],
  },
  {
    id: 'mountain_climb',
    name: 'Mountain Peak',
    description: 'Hike to summit',
    emojis: ['🥾', '⛰️', '🧗', '🏔️'],
  },
  {
    id: 'self_care',
    name: 'Self Care',
    description: 'Bath to deep rest',
    emojis: ['🛁', '🕯️', '📖', '😴'],
  },
  {
    id: 'meal_prep',
    name: 'Meal Prep',
    description: 'Veggies to hearty feast',
    emojis: ['🥕', '🔪', '🍳', '🍽️'],
  },
  {
    id: 'science_tech',
    name: 'Science & Lab',
    description: 'Lab to breakthrough',
    emojis: ['🔬', '💻', '⚙️', '🧪'],
  },
  {
    id: 'tokyo_vacay',
    name: 'Tokyo Vacation',
    description: 'Tower to shrine blossom',
    emojis: ['🗼', '🍣', '⛩️', '🌸'],
  },
  {
    id: 'nyc_vacay',
    name: 'NYC Vacation',
    description: 'Liberty to broadway',
    emojis: ['🗽', '🏙️', '🌉', '🎭'],
  },
  {
    id: 'gaming_quest',
    name: 'Gaming Quest',
    description: 'Controller to trophy',
    emojis: ['🎮', '🕹️', '⚔️', '🏆'],
  },
  {
    id: 'medical_care',
    name: 'Medical & Care',
    description: 'Care to vital heart',
    emojis: ['🩺', '💊', '🏥', '🫀'],
  },
  {
    id: 'law_justice',
    name: 'Law & Justice',
    description: 'Scales to judge',
    emojis: ['⚖️', '📜', '🏛️', '🧑‍⚖️'],
  },
  {
    id: 'zen_mind',
    name: 'Zen Meditation',
    description: 'Candle to peaceful mind',
    emojis: ['🕯️', '🍵', '🪷', '🧘'],
  },
  {
    id: 'fire_streak',
    name: 'Flame Mastery',
    description: 'Spark to crowned flame',
    emojis: ['🪵', '🕯️', '🔥', '👑'],
  },
];

export const DEFAULT_TALLY_THEME = 'growing_tree';
export const DEFAULT_CUSTOM_EMOJIS = ['🌰', '🌱', '🌿', '🌳'];

export function getTallyTheme(id?: string): TallyTheme {
  const match = TALLY_THEMES.find(t => t.id === id);
  return match || TALLY_THEMES[0];
}

/**
 * Returns an array of emojis matching the number of total cycles
 */
export function resolveTallyEmojis(
  themeId?: string,
  customEmojis?: string[],
  totalCycles = 4
): string[] {
  const count = Math.max(1, totalCycles);
  let baseEmojis: string[];

  if (themeId === 'custom' && customEmojis && customEmojis.length >= 2) {
    baseEmojis = customEmojis.filter(e => typeof e === 'string' && e.trim());
    if (baseEmojis.length === 0) baseEmojis = DEFAULT_CUSTOM_EMOJIS;
  } else {
    const theme = getTallyTheme(themeId);
    baseEmojis = [...theme.emojis];
  }

  if (count === baseEmojis.length) {
    return baseEmojis;
  }

  // If user configured a different cycle count, map or cycle smoothly
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.min(
      baseEmojis.length - 1,
      Math.floor((i / (count - 1 || 1)) * (baseEmojis.length - 1))
    );
    result.push(baseEmojis[idx]);
  }
  return result;
}
