import { MULTILINGUAL_QUOTES, type LanguageCode } from './i18n';
import type { QuotesSettings } from '../types';
import { dayKey, hashStr } from './utils';

export interface ToxicQuoteEntry {
  id: number;
  english: string;
  tamil: string;
}

export const TOXIC_MOTIVATION_QUOTES: ToxicQuoteEntry[] = [
  { id: 1, english: 'You are supposed to suffer.', tamil: 'நீ கஷ்டப்பட வேண்டியவன்தான்.' },
  {
    id: 2,
    english: 'If you want to become a star, you must burn.',
    tamil: 'நீ ஒரு நட்சத்திரமாக வேண்டுமென்றால், எரிந்துதான் ஆக வேண்டும்.',
  },
  {
    id: 3,
    english: 'Nobody cares about your excuses; they only care about your results.',
    tamil: 'உன் சாக்குப்போக்குகளைப் பற்றி யாருக்கும் கவலையில்லை; உன் வெற்றியைப் பற்றி மட்டுமே கவலை.',
  },
  {
    id: 4,
    english: 'Sleep is for people who are already successful.',
    tamil: 'தூக்கம் என்பது ஏற்கனவே வெற்றி பெற்றவர்களுக்கானது.',
  },
  {
    id: 5,
    english: 'If you are tired, do it tired.',
    tamil: 'நீ சோர்வாக இருந்தால், அந்தச் சோர்வோடே செய்.',
  },
  {
    id: 6,
    english: 'Your comfort zone is where your dreams go to die.',
    tamil: 'உன் சௌகரியமான வட்டம்தான் உன் கனவுகள் சாகும் இடம்.',
  },
  {
    id: 7,
    english: 'You are not overwhelmed; you are just under-disciplined.',
    tamil: 'உனக்கு வேலைப்பளு அதிகமில்லை; உன்னிடம் ஒழுக்கம்தான் குறைவாக இருக்கிறது.',
  },
  {
    id: 8,
    english: 'Outwork everyone, even if it costs you your peace.',
    tamil: 'உன் நிம்மதியே போனாலும் பரவாயில்லை, எல்லோரையும் விட கடினமாக உழை.',
  },
  {
    id: 9,
    english: 'Pain is temporary, regret is forever.',
    tamil: 'வலி தற்காலிகமானது, வருத்தம் நிரந்தரமானது.',
  },
  {
    id: 10,
    english: 'Stop crying about the workload and start working.',
    tamil: 'வேலைப்பளுவைப் பற்றி அழுவதை நிறுத்திவிட்டு வேலையைத் தொடங்கு.',
  },
  {
    id: 11,
    english: 'Nobody is coming to save you; bleed in silence and keep moving.',
    tamil: 'உன்னைக் காப்பாற்ற யாரும் வரப்போவதில்லை; மௌனமாக ரத்தம் சிந்தி முன்னேறிச் செல்.',
  },
  {
    id: 12,
    english: "If you aren't bleeding, you aren't trying hard enough.",
    tamil: 'நீ ரத்தம் சிந்தவில்லை என்றால், நீ போதுமான அளவு முயற்சி செய்யவில்லை என்று அர்த்தம்.',
  },
  {
    id: 13,
    english: "Rest when you're dead, not when you're behind.",
    tamil: 'இறந்த பிறகு ஓய்வெடு, பின்தங்கியிருக்கும் போது அல்ல.',
  },
  {
    id: 14,
    english: "Your feelings don't pay the bills.",
    tamil: 'உன் உணர்ச்சிகள் உன் பில்களைக் கட்டாது.',
  },
  {
    id: 15,
    english: 'Destroy your old self, even if it hurts.',
    tamil: 'வலித்தாலும் பரவாயில்லை, உன் பழைய சுயத்தை அழித்துவிடு.',
  },
  {
    id: 16,
    english: 'Mediocrity is a disease, and comfort is the carrier.',
    tamil: 'சராசரியாக இருப்பது ஒரு நோய், சௌகரியமே அதைப் பரப்புகிறது.',
  },
  {
    id: 17,
    english: 'While you rest, someone else is taking what belongs to you.',
    tamil: 'நீ ஓய்வெடுக்கும் நேரத்தில், உனக்குச் சொந்தமானதை வேறு யாரோ தட்டிப் பறித்துக் கொண்டிருக்கிறார்கள்.',
  },
  {
    id: 18,
    english: 'Burn the bridges so you have no choice but to win.',
    tamil: 'வெற்றி பெறுவதைத் தவிர வேறு வழியில்லாதபடி பின்வாங்கும் பாலங்களை எரித்துவிடு.',
  },
  {
    id: 19,
    english: 'Weakness is a choice you make every time you hit snooze.',
    tamil: 'அலாரத்தை அணைக்கும் ஒவ்வொரு முறையும் நீ தேர்ந்தெடுப்பது பலவீனத்தைத்தான்.',
  },
  {
    id: 20,
    english: 'If you want to shine like a diamond, get ready to be crushed under pressure.',
    tamil: 'வைரம் போல் ஜொலிக்க வேண்டுமென்றால், அழுத்தத்தில் நசுங்கத் தயாராக இரு.',
  },
  {
    id: 21,
    english: "Sacrifice your today so your tomorrow doesn't look like yesterday.",
    tamil: 'உன் நாளை நேற்றைப் போல இருக்கக் கூடாதென்றால், உன் இன்றைத் தியாகம் செய்.',
  },
  {
    id: 22,
    english: 'Stop asking for an easier life and start tolerating more pain.',
    tamil: 'எளிதான வாழ்க்கையைக் கேட்பதை நிறுத்திவிட்டு, அதிக வலியைத் தாங்கப் பழகு.',
  },
  {
    id: 23,
    english: "Your future self is watching you right now through memories; don't disappoint them.",
    tamil: 'உன் எதிர்காலம் உன்னை இப்போது நினைவுகள் வழியாகப் பார்த்துக் கொண்டிருக்கிறது; அதை ஏமாற்றிவிடாதே.',
  },
  {
    id: 24,
    english: 'Emotions are anchors that keep you from sailing.',
    tamil: 'உணர்ச்சிகள் என்பவை உன்னைப் பயணிக்க விடாமல் தடுக்கும் நங்கூரங்கள்.',
  },
  {
    id: 25,
    english: "If it doesn't break you, you didn't push hard enough.",
    tamil: 'அது உன்னை உடைக்கவில்லை என்றால், நீ போதுமான அளவு கடினமாக முயற்சிக்கவில்லை.',
  },
  {
    id: 26,
    english: 'Be obsessed or be average.',
    tamil: 'வெறித்தனமாக இரு அல்லது சராசரியாக இரு.',
  },
  {
    id: 27,
    english: "You don't need balance; you need obsession.",
    tamil: 'உனக்குச் சமநிலை தேவையில்லை; வெறித்தனம்தான் தேவை.',
  },
  {
    id: 28,
    english: 'Swallow your pride, endure the humiliation, and build your empire.',
    tamil: 'கர்வத்தை விழுங்கு, அவமானங்களைத் தாங்கு, உன் சாம்ராஜ்யத்தைக் கட்டு.',
  },
  {
    id: 29,
    english: "Hunger doesn't care if you're exhausted.",
    tamil: 'நீ சோர்வாக இருக்கிறாயா என்பதைப் பற்றிப் பசி கவலைப்படாது.',
  },
  {
    id: 30,
    english: 'Suffer the pain of discipline now, or suffer the pain of failure forever.',
    tamil: 'இப்போது ஒழுக்கத்தின் வலியை அனுபவி, அல்லது என்றென்றும் தோல்வியின் வலியை அனுபவி.',
  },
  {
    id: 31,
    english: 'Lonely nights build legendary days.',
    tamil: 'தனிமையான இரவுகளே சரித்திரம் பேசும் நாட்களை உருவாக்குகின்றன.',
  },
  {
    id: 32,
    english: 'Break your own heart before the world does it for you.',
    tamil: 'இந்த உலகம் உன் இதயத்தை உடைப்பதற்கு முன், நீயே உன்னைப் பக்குவப்படுத்திக் கொள்.',
  },
  {
    id: 33,
    english: 'There is no glory without scars.',
    tamil: 'தழும்புகள் இல்லாமல் எந்தப் பெருமையும் இல்லை.',
  },
  {
    id: 34,
    english: 'Work until your idols become your rivals.',
    tamil: 'உன் முன்மாதிரிகள் உன் போட்டியாளர்களாக மாறும் வரை உழை.',
  },
  {
    id: 35,
    english: 'If you quit now, you deserve every bit of your failure.',
    tamil: 'நீ இப்போது விலகினால், உன் தோல்வியின் ஒவ்வொரு துளிக்கும் நீ தகுதியானவனே.',
  },
];

export function getActiveQuoteList(lang: LanguageCode | string, toxicMotivation = false): string[] {
  if (toxicMotivation) {
    return TOXIC_MOTIVATION_QUOTES.map(q => (lang === 'ta' ? q.tamil : q.english));
  }
  return MULTILINGUAL_QUOTES[lang as LanguageCode] || MULTILINGUAL_QUOTES.en;
}

export function selectStageQuote(
  quotesSettings: QuotesSettings,
  lang: LanguageCode | string,
  now: Date,
  visitSeed = 0
): string {
  if (quotesSettings.useCustom && quotesSettings.custom.trim()) {
    return quotesSettings.custom.trim();
  }
  const quoteList = getActiveQuoteList(lang, !!quotesSettings.toxicMotivation);
  if (quoteList.length === 0) return '';
  let i = 0;
  if (quotesSettings.rotation === 'hourly') {
    i = hashStr(dayKey(now.getTime()) + now.getHours()) % quoteList.length;
  } else if (quotesSettings.rotation === 'visit') {
    i = Math.abs(visitSeed) % quoteList.length;
  } else {
    i = hashStr(dayKey(now.getTime())) % quoteList.length;
  }
  return quoteList[i];
}
