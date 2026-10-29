import { useSyncExternalStore } from 'react';

export type Language = 'en' | 'my';

export const LANGUAGES: Array<{ id: Language; label: string; nativeLabel: string }> = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'my', label: 'Burmese', nativeLabel: 'မြန်မာ' },
];

const STORAGE_KEY = 'slap_run_language';

function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'my' || saved === 'en') return saved;
  } catch {}
  // Burmese ships as the default: the game is built for Myanmar players, and
  // anyone who wants English picks it once in Settings.
  return 'my';
}

let currentLanguage: Language = typeof window === 'undefined' ? 'en' : readLanguage();
const listeners = new Set<() => void>();

function applyDocumentLanguage(language: Language): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.classList.toggle('lang-my', language === 'my');
}

if (typeof document !== 'undefined') {
  applyDocumentLanguage(currentLanguage);
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  if (language === currentLanguage) return;
  currentLanguage = language;
  applyDocumentLanguage(language);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, () => currentLanguage, () => currentLanguage);
}

/**
 * Translation lookup. English strings are the keys, so any screen that has not
 * been translated yet keeps working and simply falls back to English.
 */
const BURMESE: Record<string, string> = {
  // Shared
  Close: 'ပိတ်',
  Save: 'သိမ်း',
  SAVED: 'သိမ်းပြီး',
  SAVE: 'သိမ်း',
  ON: 'ဖွင့်',
  OFF: 'ပိတ်',
  ENABLED: 'ဖွင့်ထား',
  'SHARE THIS RIDE': 'ဤပြေးပွဲကို မျှဝေရန်',
  RUNNER: 'ကစားသမား',
  'SHARE CARD SAVED': 'မျှဝေကတ် သိမ်းပြီး',
  'SHARE NOT AVAILABLE': 'မျှဝေမရပါ',
  'I scored {score} in Swiposaur!': 'Swiposaur တွင် {score} မှတ် ရခဲ့သည်!',
  NORMAL: 'ပုံမှန်',
  MUTED: 'အသံပိတ်',
  BACK: 'နောက်သို့',
  CLAIM: 'ရယူ',
  Continue: 'ဆက်လက်',
  'Collect Reward': 'ဆုလာဘ် ရယူ',
  Loading: 'ဖွင့်နေသည်',

  // Menu
  Best: 'အကောင်းဆုံး',
  Coins: 'ရွှေဒင်္ဂါး',
  REWARDS: 'ဆုလာဘ်',
  'Daily Dino Egg Hatch': 'နေ့စဉ် ဒိုင်နိုဥ ဖောက်ခြင်း',
  Guide: 'လမ်းညွှန်',
  Settings: 'ဆက်တင်',
  Unmute: 'အသံဖွင့်',
  Mute: 'အသံပိတ်',
  PLAY: 'ကစားမည်',
  'DINO SKINS': 'ဒိုင်နို အသွင်အပြင်',
  MAPS: 'မြေပုံများ',
  MISSIONS: 'တာဝန်များ',
  'HALL OF FAME': 'ဂုဏ်ထူးဆောင်စာရင်း',
  'Tail-Whip / Jump': 'အမြီးရိုက် / ခုန်',
  'Dodge Lanes': 'လမ်းကြော ရွှေ့',
  'Tail-Whip': 'အမြီးရိုက်',
  Jump: 'ခုန်',
  'Level {level}': 'အဆင့် {level}',
  'Explore 12 prehistoric habitats with dynamic weather & obstacles':
    'ရာသီဥတုပြောင်းလဲမှုနှင့် အတားအဆီးများရှိ ရှေးဟောင်းဒိုင်နို နေရာ ၁၂ ခုကို စူးစမ်းပါ',
  easy: 'လွယ်',
  medium: 'အလယ်အလတ်',
  hard: 'ခက်',
  'Swipe & Tap on Touch!': 'ဖုန်းတွင် ပွတ်ဆွဲပြီး နှိပ်ပါ!',

  // HUD
  Score: 'ရမှတ်',
  'DINO ENERGY': 'ဒိုင်နို စွမ်းအင်',
  'PRIMAL MAYHEM': 'ရှေးဦး ရန်အား',
  'Flame Mode': 'မီးမုဒ်',
  'STAMPEDE ON YOUR TAIL! RUN FAST TO SHAKE THEM OFF!':
    'အမြီးနောက် လူအုပ်လိုက်နေသည်! လွတ်မြောက်ရန် အမြန်ပြေးပါ!',
  'Toggle Audio': 'အသံ ဖွင့်/ပိတ်',
  Pause: 'ခေတ္တရပ်',

  // Pause overlay
  'Sprint Paused': 'ပြေးနေမှု ရပ်ထား',
  PAUSED: 'ခေတ္တရပ်',
  'RESUME SPRINT': 'ပြန်စတင်မည်',
  RESTART: 'ပြန်စမည်',
  'DAILY MISSIONS': 'နေ့စဉ် တာဝန်များ',
  'MAIN MENU': 'ပင်မမီနူး',

  // Intro + tutorial
  'WHIP {name}!': '{name} ကို အမြီးနှင့် ရိုက်ပါ!',
  'TAP WHIP OR PRESS SPACE FOR MEGA TAIL-WHIP!':
    'MEGA အမြီးရိုက်ချက်အတွက် WHIP ကို နှိပ်ပါ!',
  'First Run': 'ပထမဆုံး ကစားခြင်း',
  'Dodge Right': 'ညာဘက်သို့ ရွှေ့ပါ',
  'Tap the arrow to whip into the open lane.':
    'မြှားကို နှိပ်ပြီး လွတ်နေသော လမ်းသို့ ရွှေ့ပါ။',
  RIGHT: 'ညာ',
  'Other controls are paused for this lesson':
    'ဤသင်ခန်းစာအတွင်း အခြားထိန်းချုပ်မှုများ ရပ်ထားသည်',

  // Touch controls
  Vault: 'ခုန်',
  JUMP: 'ခုန်',
  'WHIP!': 'ရိုက်!',
  'Hit Target': 'ပစ်မှတ်ကို ရိုက်',
  'Jump left into left lane': 'ဘယ်ဘက်လမ်းသို့ ခုန်ဝင်ရန်',
  'Vault jump': 'ခုန်ရန်',
  'Jump right into right lane': 'ညာဘက်လမ်းသို့ ခုန်ဝင်ရန်',
  'Dodge left lane': 'ဘယ်ဘက်လမ်းသို့ ရွှေ့ရန်',
  'Dodge right lane': 'ညာဘက်လမ်းသို့ ရွှေ့ရန်',
  'Tail-whip slap button': 'အမြီးရိုက် ခလုတ်',
  'Switch to Joystick': 'ဂျွိုက်စတစ်သို့ ပြောင်း',
  'Switch to D-Pad': 'ဒီပက်သို့ ပြောင်း',
  'Jump L': 'ခုန် ဘယ်',
  'Jump R': 'ခုန် ညာ',

  // Settings
  'GAME SETTINGS': 'ဂိမ်း ဆက်တင်',
  'Tune graphics, audio, camera & controls': 'ဂရပ်ဖစ်၊ အသံ၊ ကင်မရာနှင့် ထိန်းချုပ်မှုများ',
  Language: 'ဘာသာစကား',
  'Game language': 'ဂိမ်း ဘာသာစကား',
  'English and Burmese are available. The choice is saved on this device.':
    'အင်္ဂလိပ်နှင့် မြန်မာ ဘာသာစကား ရွေးနိုင်သည်။ ရွေးချယ်မှုကို ဤစက်တွင် သိမ်းထားမည်။',
  'Leaderboard Name': 'ဂုဏ်ထူးဆောင်စာရင်း အမည်',
  'Shown on the global board. Auto-generated until you change it.':
    'ကမ္ဘာ့စာရင်းတွင် ပြသမည်။ မပြောင်းမချင်း အလိုအလျောက် ဖန်တီးထားသည်။',
  'Leaderboard name': 'ဂုဏ်ထူးဆောင်စာရင်း အမည်',
  'Audio & Arcade Synth Beat': 'အသံနှင့် အာကိတ် ဂီတ',
  'Muted': 'အသံပိတ်ထား',
  'Enabled (Zero-lag synth)': 'ဖွင့်ထား (နောက်ကျမှုမရှိ ဂီတ)',
  'Cartoon Impact Screen Shake': 'ရိုက်ခတ်မှု ကင်မရာ တုန်ခါမှု',
  'Juicy hit-stop & rumble during critical tail slaps':
    'အမြီးရိုက်ချက်များတွင် ထိမှန်ရပ်တန့်မှုနှင့် တုန်ခါမှု',
  'Camera Perspective': 'ကင်မရာ ရှုထောင့်',
  'Classic Arcade Overview': 'ဂန္ထဝင် အာကိတ် မြင်ကွင်း',
  'Close-Up Dino Action Cam': 'ဒိုင်နို အနီး အက်ရှင်ကင်မရာ',
  'On-Screen Controls': 'မျက်နှာပြင် ထိန်းချုပ်မှုများ',
  'Virtual joystick and action buttons': 'ဂျွိုက်စတစ်နှင့် လုပ်ဆောင်ချက် ခလုတ်များ',
  'Show Lane Buttons': 'လမ်းကြော ခလုတ်များ ပြရန်',
  'Reduced Motion': 'ရွေ့လျားမှု လျှော့ချ',
  'Softer camera motion and fewer shake effects': 'ကင်မရာ ရွေ့လျားမှုနှင့် တုန်ခါမှု လျှော့ချ',
  'Reset Progress': 'တိုးတက်မှု ပြန်စရန်',
  'Erase levels, coins, skins and local scores': 'အဆင့်၊ ဒင်္ဂါး၊ အသွင်အပြင်နှင့် ရမှတ်များ ဖျက်ရန်',
  'Are you sure? This cannot be undone.': 'သေချာပါသလား? ပြန်လည် မရနိုင်ပါ။',
  'YES, RESET EVERYTHING': 'ဟုတ်သည်၊ အားလုံး ပြန်စမည်',
  Cancel: 'မလုပ်တော့',

  // Daily rewards
  'DINO EGG HATCHERY': 'ဒိုင်နို ဥ ဖောက်စက်',
  '7-DAY STREAK': '၇ ရက် ဆက်တိုက်',
  'Log in daily to hatch dinosaur fossils & bonus coins!':
    'နေ့စဉ် ဝင်ကစားပြီး ဒိုင်နို ကျောက်ဖြစ်ရုပ်ကြွင်းနှင့် ဆုဒင်္ဂါးများ ရယူပါ!',
  'HATCH TODAY\u2019S DINO EGG': 'ယနေ့ ဒိုင်နို ဥကို ဖောက်မည်',
  'EGG HATCHED!': 'ဥ ဖောက်ပြီး!',
  'The egg is wobbling...': 'ဥ လှုပ်နေသည်...',
  'Hatching...': 'ဥ ဖောက်နေသည်...',
  'Egg Hatched!': 'ဥ ဖောက်ပြီး!',
  'Dino Egg Hatchery': 'ဒိုင်နို ဥ ဖောက်စက်',
  'Added to your dino bank': 'သင့် ဒိုင်နို ဘဏ်ထဲ ထည့်ပြီး',
  'Egg hatching reward': 'ဥ ဖောက်ခြင်း ဆုလာဘ်',
  'Day {day}': 'ရက် {day}',
  'Today\u2019s Dino Egg is already hatched! Come back tomorrow for Day {day}!':
    'ယနေ့ ဥ ကို ဖောက်ပြီးပါပြီ! မနက်ဖန် ရက် {day} အတွက် ပြန်လာပါ!',

  // Missions
  'DAILY BOUNTIES': 'နေ့စဉ် တာဝန်များ',
  'Daily Missions': 'နေ့စဉ် တာဝန်များ',
  'Daily Bounties': 'နေ့စဉ် တာဝန်များ',
  'Claim All': 'အားလုံး ရယူ',
  'Claim': 'ရယူ',
  Claimed: 'ရယူပြီး',
  'Refresh in': 'အသစ်ပြောင်းရန်',
  'Complete missions to earn bonus coins & stamina':
    'ဆုဒင်္ဂါးနှင့် စွမ်းအင် ရယူရန် တာဝန်များကို ပြီးမြောက်ပါ',

  // Game over
  'GAME OVER': 'ကစားမှု ပြီးဆုံး',
  'RUN COMPLETE': 'ပြေးမှု ပြီးဆုံး',
  'PLAY AGAIN': 'ထပ်ကစားမည်',
  'RETRY': 'ထပ်ကြိုးစား',
  'HOME': 'ပင်မ',
  'Leaderboard': 'ဂုဏ်ထူးဆောင်စာရင်း',
  'Personal Best': 'ကိုယ်ပိုင် အကောင်းဆုံး',
  'NEW PERSONAL BEST!': 'ကိုယ်ပိုင် အကောင်းဆုံး သစ်!',
  'Distance': 'အကွာအဝေး',
  'Stamina': 'စွမ်းအင်',
  'Combo': 'ဆက်တိုက်',
  'Slaps': 'ရိုက်ချက်',
  'Coins Collected': 'ရယူထားသော ဒင်္ဂါး',

  // Additional HUD / menu strings
  'ROAR!': 'ဟိန်း!',
  'PRIMAL ROAR': 'ရှေးဦး ဟိန်းသံ',
  LEFT: 'ဘယ်',
  'Dodge right': 'ညာဘက်သို့ ရွှေ့',
  'Left / Right arrow buttons on mobile HUD': 'မိုဘိုင်း HUD တွင် ဘယ်/ညာ မြှားခလုတ်များ',

  // Daily rewards egg ceremony
  'You collected': 'သင်ရရှိသည်',
  'and maintained your streak!': 'ပြီး ဆက်တိုက် မှတ်တမ်း ထိန်းထားသည်!',
  COINS: 'ဒင်္ဂါး',
  'CRACK!': 'အက်ကွဲ!',

  // Game over
  'STAMPEDE BUSTED!': 'လူအုပ် ဖမ်းမိပြီ!',
  'Caught by the Enraged Stampede Mob!': 'ဒေါသထွက်နေသော လူအုပ်က သင့်ကို ဖမ်းမိသည်!',
  'OUT OF ENERGY!': 'စွမ်းအင် ကုန်သွားပြီ!',
  'Tail-whip critters along the run to recharge stamina!':
    'စွမ်းအင် ပြန်ပြည့်ရန် လမ်းတစ်လျှောက် သတ္တဝါများကို အမြီးဖြင့် ရိုက်ပါ!',
  'RUN COMPLETED!': 'ပြေးမှု ပြီးဆုံးပြီ!',
  'Dashed {meters} meters across the resort!':
    'အပန်းဖြေစခန်းကို {meters} မီတာ ဖြတ်ပြေးခဲ့သည်!',
  'Final Dinosaur Score': 'နောက်ဆုံး ဒိုင်နို ရမှတ်',
  'OVERALL RATING': 'စုစုပေါင်း အဆင့်',
  Reflexes: 'တုံ့ပြန်မှု',
  'Submitting score…': 'ရမှတ် ပို့နေသည်…',
  'Saved locally \u2014 not submitted online.': 'စက်ထဲတွင် သိမ်းထားသည် — အွန်လိုင်း မပို့ရသေးပါ။',
  'Retry submission': 'ထပ်မံ ပို့ရန်',
  'Tail-Whips': 'အမြီးရိုက်ချက်',
  'Max Roar': 'အမြင့်ဆုံး ဟိန်းသံ',
  'Dino Coins': 'ဒိုင်နို ဒင်္ဂါး',
  'RUN AGAIN': 'ထပ်ပြေးမည်',
  'RETRY WITH +20 STAMINA': '+၂၀ စွမ်းအင်ဖြင့် ထပ်ကြိုးစား',
  'Stamina boost back in {time}': 'စွမ်းအင် အားဖြည့်မှု {time} အတွင်း ပြန်ရမည်',
  'APEX PRIMAL LEGEND': 'ရှေးဦး ဒဏ္ဍာရီ ထိပ်သီး',
  'Flawless reflexes and total street mastery!': 'အမှားအယွင်းမရှိ တုံ့ပြန်မှုနှင့် လမ်းကြော ကျွမ်းကျင်မှု!',
  'MASTER DINO DRIFTER': 'ဒိုင်နို မောင်းနှင်မှု ဆရာ',
  'Incredible agility and ruthless tail attacks!': 'အံ့ဖွယ် လျင်မြန်မှုနှင့် ပြင်းထန်သော အမြီးတိုက်ခိုက်မှုများ!',
  'SPEEDWAY CHAMPION': 'အမြန်လမ်း ချန်ပီယံ',
  'Smooth obstacle evasion with sharp reflexes!': 'ချောမွေ့စွာ အတားအဆီး ရှောင်ပြီး ထက်မြက်သော တုံ့ပြန်မှု!',
  'RISING ROARER': 'ထွန်းသစ်လာသော ဟိန်းသံရှင်',
  'Good momentum! Vault higher and dodge closer for maximum score.':
    'ကောင်းသော အရှိန်အဟုန်! အမြင့်ဆုံး ရမှတ်အတွက် ပိုမြင့်စွာ ခုန်ပြီး ပိုနီးစွာ ရှောင်ပါ။',
  'STAMPEDE ROOKIE': 'လူအုပ် အစပြုသူ',
  'Keep practicing lane switches and jump vaulting!': 'လမ်းကြော ပြောင်းခြင်းနှင့် ခုန်ခြင်းကို ဆက်လေ့ကျင့်ပါ!',
  DONE: 'ပြီးပြီ',
  'Five bounties a day, resetting at midnight': 'တစ်နေ့ ငါးခု၊ သန်းခေါင်တွင် အသစ်ပြောင်းသည်',
  'Resets at midnight (Myanmar)': 'မြန်မာစံတော်ချိန် သန်းခေါင်တွင် အသစ်ပြောင်းသည်',
  claimed: 'ရယူပြီး',
  '{time} left': 'လက်ကျန် {time}',

  // Daily missions
  'Beachside Tail Whip': 'ကမ်းခြေ အမြီးရိုက်',
  'Land 15 tail whips on silly resort critters': 'အပန်းဖြေစခန်း သတ္တဝါ ၁၅ ကောင်ကို အမြီးဖြင့် ရိုက်ပါ',
  'Tail Whip Marathon': 'အမြီးရိုက် မာရသွန်',
  'Land 30 tail whips on resort critters': 'သတ္တဝါ ၃၀ ကောင်ကို အမြီးဖြင့် ရိုက်ပါ',
  'Roar Rally': 'ဟိန်းသံ စုစည်းမှု',
  'Reach a 4x Roar multiplier in a single run': 'တစ်ခေါက်တည်း ၄ ဆ ဟိန်းသံ ရောက်ပါ',
  'Primal Crescendo': 'ရှေးဦး အားတက်သံ',
  'Reach an 8x Roar multiplier in a single run': 'တစ်ခေါက်တည်း ၈ ဆ ဟိန်းသံ ရောက်ပါ',
  'Sunny Shoreline Dash': 'နေသာကမ်းခြေ အပြေးပွဲ',
  'Sprint 600 meters without falling to the stampede': 'လူအုပ်လက်မှ မကျဘဲ ၆၀၀ မီတာ ပြေးပါ',
  'Boardwalk Endurance': 'ကမ်းခြေလမ်း ခံနိုင်ရည်',
  'Sprint 1,200 meters in a single run': 'တစ်ခေါက်တည်း ၁,၂၀၀ မီတာ ပြေးပါ',
  'Golden Shell Harvest': 'ရွှေခွံ ရိတ်သိမ်းမှု',
  'Collect 25 gold coins along the track': 'လမ်းတစ်လျှောက် ရွှေဒင်္ဂါး ၂၅ ခု စုဆောင်းပါ',
  'Treasure Trail': 'ဘဏ္ဍာလမ်း',
  'Collect 60 gold coins along the track': 'ရွှေဒင်္ဂါး ၆၀ ခု စုဆောင်းပါ',
  'Traffic Slalom': 'ယာဉ်ကြော ဆလလွန်',
  'Slip past 3 obstacles for a near miss': 'အတားအဆီး ၃ ခုကို နီးနီး လွတ်အောင် ဖြတ်ပါ',
  'Close Call Collector': 'နီးနီးလွတ် စုဆောင်းသူ',
  'Slip past 6 obstacles for near misses': 'အတားအဆီး ၆ ခုကို နီးနီး လွတ်အောင် ဖြတ်ပါ',
  'Speedway Contender': 'အမြန်လမ်း ပြိုင်ပွဲဝင်',
  'Finish a run with Grade A or better': 'အဆင့် A သို့မဟုတ် ထို့ထက် ကောင်းစွာ ပြီးပါ',
  'Stampede Legend': 'လူအုပ် ဒဏ္ဍာရီ',
  'Finish a run with Grade S or better': 'အဆင့် S သို့မဟုတ် ထို့ထက် ကောင်းစွာ ပြီးပါ',

  // Survival guide
  'DINO SURVIVAL GUIDE': 'ဒိုင်နို အသက်ရှင်နည်း လမ်းညွှန်',
  'How to tail-whip, dodge stampedes & trigger Primal Roars':
    'အမြီးဖြင့် ရိုက်ခြင်း၊ လူအုပ်ကို ရှောင်ခြင်းနှင့် ရှေးဦး ဟိန်းသံ ဖွင့်ခြင်း',
  'TAIL-WHIP CRITTERS': 'အမြီးဖြင့် ရိုက်ပါ',
  'Whack cheeky dodos, crabs & beach cavemen as you sprint past! Each hit boosts your Dino Energy and builds your Roar combo!':
    'ပြေးနေစဉ် ဒိုဒို၊ ပုစွန်နှင့် ကမ်းခြေလူများကို ရိုက်ပါ! တိုက်ခိုက်မှုတိုင်းက စွမ်းအင်နှင့် Roar ဆက်တိုက်မှု တက်စေသည်!',
  'ESCAPE STAMPEDES': 'လူအုပ်ထံမှ လွတ်မြောက်',
  "Missing too many targets enrages the chasing stampede mob! Don't let them catch up to your tail or you'll get Busted!":
    'ပစ်မှတ် အများကြီး လွတ်သွားရင် လိုက်နေသော လူအုပ် ဒေါသထွက်သည်! သင့်အမြီးနောက် မမီလာစေပါနှင့်!',
  'PRIMAL ROAR FEVER': 'ရှေးဦး ဟိန်းသံ ရောဂါ',
  'Fill the Mayhem Meter to ignite 16x score multiplier and invincible sprint boost with party fireworks!':
    'Mayhem တိုင်း ပြည့်အောင်ထားပြီး ၁၆ ဆ ရမှတ်နှင့် မခံနိုင်သော ပြေးအား ရယူပါ!',
  'COLLECT DINO COINS': 'ဒိုင်နို ဒင်္ဂါး စုရန်',
  'Grab golden fossils and coins across the track to unlock new party dinosaurs in the paddock!':
    'ရွှေကျောက်ဖြစ်ရုပ်ကြွင်းနှင့် ဒင်္ဂါးများ စုပြီး အသစ်သော ပါတီဒိုင်နိုများ ဖွင့်ပါ!',
  'CONTROLS CHEAT SHEET': 'ထိန်းချုပ်မှု အကျဉ်းချုပ်',
  'Jump & Tail-Whip': 'ခုန်နှင့် အမြီးရိုက်',
  'Swerve Lanes': 'လမ်းကြော ပြောင်း',
  'Sprint Jump': 'အပြေး ခုန်',
  'Mobile:': 'မိုဘိုင်း:',
  'Swipe & Tap buttons': 'ပွတ်ဆွဲပြီး ခလုတ် နှိပ်ပါ',
  'READY FOR MAYHEM!': 'အမှောင်းအတွက် အဆင်သင့်!',

  // Hall of fame / leaderboard
  'GLOBAL LEADERBOARD': 'ကမ္ဘာ့ ဂုဏ်ထူးဆောင်စာရင်း',
  'Best score per player, saved online': 'ကစားသမားတစ်ဦးချင်း အကောင်းဆုံးရမှတ်၊ အွန်လိုင်းတွင် သိမ်းထားသည်',
  'Saved on this device': 'ဤစက်တွင် သိမ်းထားသည်',
  'Your Best': 'သင့် အကောင်းဆုံး',
  'Saved on the server': 'ဆာဗာတွင် သိမ်းထားသည်',
  GLOBAL: 'ကမ္ဘာ့',
  LOCAL: 'စက်',
  'No scores on the online board yet — finish a run to be the first.':
    'အွန်လိုင်းစာရင်းတွင် ရမှတ် မရှိသေးပါ — ပထမဆုံး ဖြစ်ရန် တစ်ခေါက် ပြေးပါ။',
  'No saved runs yet — finish a run to set your local best.':
    'သိမ်းထားသော မှတ်တမ်း မရှိသေးပါ — ကိုယ်ပိုင် အကောင်းဆုံး သတ်မှတ်ရန် တစ်ခေါက် ပြေးပါ။',
  'All players': 'ကစားသမား အားလုံး',
  'Local Hall of Fame': 'စက်ထဲက ဂုဏ်ထူးဆောင်စာရင်း',
  'Self-reported': 'ကိုယ်တိုင် ဖော်ပြထား',
  'This device only': 'ဤစက်တွင်သာ',
  'LOCAL RANK #{rank}': 'စက် အဆင့် #{rank}',
  'GLOBAL RANK #{rank}': 'ကမ္ဘာ့ အဆင့် #{rank}',

  // Gameplay toasts (mission cleared during a run, achievement popups)
  'ACHIEVEMENT UNLOCKED!': 'ဂုဏ်ပြုဆု ဖွင့်ပြီး!',
  'Mission: {title}': 'တာဝန်: {title}',
  '{count} missions ready — claim +{coins} Coins and more!':
    'တာဝန် {count} ခု ပြီးဆုံးပါပြီ — +{coins} ဒင်္ဂါးနှင့် အခြားဆုများ ရယူပါ!',
  'Claim +{coins} Coins and +{stamina} stamina!': '+{coins} ဒင်္ဂါးနှင့် +{stamina} စွမ်းအင် ရယူပါ!',

  // Trophies & badges screen
  'DINO TROPHIES & BADGES': 'ဒိုင်နို ဆုဖလားနှင့် တံဆိပ်များ',
  'Unlock achievements to earn bonus Dino Gold Coins':
    'ဆုအောင်မြင်မှုများ ဖွင့်ပြီး ဒိုင်နို ရွှေဒင်္ဂါး ရယူပါ',
  'All Trophies': 'ဆုဖလား အားလုံး',
  'Tail Slaps': 'အမြီးရိုက်ချက်',
  Survival: 'အသက်ရှင်ခြင်း',
  'Speed & Combo': 'အမြန်နှုန်းနှင့် ဆက်တိုက်မှု',
  Milestones: 'မှတ်တိုင်များ',
  CLAIMED: 'ရယူပြီး',
  'Complete trophies during runs to claim Dino Gold':
    'ပြေးနေစဉ်တွင် ဆုဖလား ပြီးအောင်လုပ်ပြီး ဒိုင်နို ရွှေ ရယူပါ',
  'Total Gold Bank: {coins}': 'စုစုပေါင်း ရွှေဘဏ်: {coins}',

  // Achievements
  'First Dino Slap!': 'ပထမဆုံး ဒိုင်နို ရိုက်ချက်!',
  'Land your first goofy critter tail-slap': 'ပထမဆုံး ရယ်ဖွယ်ကောင်းသော သတ္တဝါကို အမြီးဖြင့် ရိုက်ပါ',
  'Tail Whirlwind': 'အမြီး လေနာဟာရီ',
  'Reach a x5 Slap Combo streak': 'ရိုက်ချက် ဆက်တိုက် ၅ ခု စုရန်',
  'Unstoppable Dino': 'မရပ်နိုင်သော ဒိုင်နို',
  'Reach a blistering x15 Slap Combo streak': 'ရိုက်ချက် ဆက်တိုက် ၁၅ ခု စုရန်',
  'Primal Berserker': 'ရှေးဦး စစ်သည်ကြမ်း',
  'Reach an insane x25 Slap Combo streak': 'ရိုက်ချက် ဆက်တိုက် ၂၅ ခု စုရန်',
  'Warm-up Lap': 'လေ့ကျင့်ခန်း တစ်ပတ်',
  'Sprint 100 meters down the beach track': 'ကမ်းခြေလမ်းတွင် ၁၀၀ မီတာ ပြေးပါ',
  'Long-Distance Saurian': 'အဝေးပြေး ဆိုရီယန်',
  'Sprint 500 meters without getting caught': 'မဖမ်းမိဘဲ ၅၀၀ မီတာ ပြေးပါ',
  'Prehistoric Marathon': 'ရှေးဟောင်း မာရသွန်',
  'Survive a 1,000 meter wild sprint': '၁,၀၀၀ မီတာ ပြေးပြီး အသက်ရှင်ပါ',
  'Pocket Change': 'အနည်းငယ်သော ဒင်္ဂါး',
  'Collect 100 total shiny gold coins': 'ရွှေဒင်္ဂါး ၁၀၀ ခု စုဆောင်းပါ',
  'Dino Gold Hoarder': 'ဒိုင်နို ရွှေ သိမ်းဆည်းသူ',
  'Collect 500 total shiny gold coins': 'ရွှေဒင်္ဂါး ၅၀၀ ခု စုဆောင်းပါ',
  'Primal Roar Frenzy!': 'ရှေးဦး ဟိန်းသံ ကြွယ်ဝမှု!',
  'Max out the Chaos Meter and unleash Fever Mode':
    'Chaos တိုင်း ပြည့်အောင်လုပ်ပြီး Fever မုဒ် ဖွင့်ပါ',
  'Party Crasher': 'ပါတီ ဖျက်သူ',
  'Tail-slap 50 prehistoric bystanders in total': 'ရှေးဟောင်း လူများကို အမြီးဖြင့် ၅၀ ကောင် ရိုက်ပါ',
  'Master Tail Whipper': 'အမြီးရိုက် ပညာရှင်',
  'Tail-slap 150 prehistoric bystanders in total': 'ရှေးဟောင်း လူများကို အမြီးဖြင့် ၁၅၀ ကောင် ရိုက်ပါ',
  'Narrow Escape': 'ချောင်းကြား လွတ်မြောက်မှု',
  'Flee with the angry mob less than 50m behind you':
    'ဒေါသထွက်နေသော လူအုပ် ၅၀ မီတာအတွင်း နောက်ကျိုက်နေစဉ် ထွက်ပြေးပါ',
  'Airborne Raptor': 'ပျံသန်းသော ရက်ပ်တာ',
  'Perform 5 jump ramp boosts in a single sprint': 'တစ်ခေါက်တည်းတွင် ခုန်တက်ဘုတ် ၅ ခု အသုံးပြုပါ',
  'Island Hopper': 'ကျွန်း ခုန်ကျော်သူ',
  'Unlock Level 5 and reach the Lagoon Surf Boardwalk':
    'အဆင့် ၅ ဖွင့်ပြီး လဂ်ရေကူး စားပွဲလမ်းသို့ ရောက်ပါ',
  'Volcano Survivor': 'မီးတောင် ရှင်သန်သူ',
  'Unlock Level 10 and cross Rumble Volcano Canyon':
    'အဆင့် ၁၀ ဖွင့်ပြီး မီးတောင် ကျောက်ညှပ်ကို ဖြတ်ပါ',
  'Star Collector': 'ကြယ် စုဆောင်းသူ',
  'Earn 15 total golden stage stars': 'ရွှေကြယ် ၁၅ ပွင့် ရရှိပါ',
  'Fashion Wardrobe': 'ဖက်ရှင် အဝတ်ဗီဒို',
  'Unlock 3 distinct Dino character skins': 'ဒိုင်နို အသွင်အပြင် ၃ မျိုး ဖွင့်ပါ',
  'Close Shave': 'ချောင်းကြား လွတ်မြောက်မှု',
  'Graze past 10 obstacles with near-miss reflexes': 'အတားအဆီး ၁၀ ခုကို နီးကပ်စွာ ရှောင်ကျဉ်ပါ',
  'Arcade Legend': 'အာကိတ် ဒဏ္ဍာရီ',
  'Score over 10,000 points in a single run': 'တစ်ခေါက်တည်းတွင် ၁၀,၀၀၀ မှတ်အထက် ရရှိပါ',
  'Prehistoric God': 'ရှေးဟောင်း နတ်ဘုရား',
  'Score over 25,000 points in a single run': 'တစ်ခေါက်တည်းတွင် ၂၅,၀၀၀ မှတ်အထက် ရရှိပါ',

  // Map select modal (Maps menu)
  'Prehistoric Dino Havens': 'ရှေးဟောင်း ဒိုင်နို ခိုလှုံရာများ',
  'EXPLORE ISLAND BIOMES': 'ကျွန်းဇုန်များ စူးစမ်းရန်',
  'Run through 6 tropical prehistoric habitats with dynamic weather & obstacles':
    'ရာသီဥတုပြောင်းလဲမှုနှင့် အတားအဆီးများရှိ အပူပိုင်း ရှေးဟောင်းဒိုင်နို နေရာ ၆ ခုကို ဖြတ်ပြေးပါ',
  'Lv. {level} Explorer': 'အဆင့် {level} စူးစမ်းသူ',
  'Unlock at Level {level}': 'အဆင့် {level} တွင် ဖွင့်ပါ',
  'CURRENT BIOME': 'လက်ရှိ ဇုန်',
  'ACTIVE HABITAT': 'လက်ရှိ နေရာ',
  'TRAVEL HERE': 'ဤနေရာသို့ သွားရန်',
  'LOCKED BIOME': 'ပိတ်ထားသော ဇုန်',

  // Map names, themes & taglines
  'Bazaar Boulevard': 'ဈေးလမ်းမကြီး',
  'Traditional Daylight Market': 'ရှေးဟောင်း နေ့လယ်ဈေး',
  'Sun-drenched bustling market street with fruit stalls & fresh pavement':
    'သစ်သီးဈေးဆိုင်များနှင့် လတ်ဆတ်သော လမ်းကြား ပြည့်နှက်နေသော နေရောင်ထိုး ဈေးလမ်း',
  'Sunny Palm Bay': 'နေသာ ရေမြောကမ်းခြေ',
  'Tropical Ocean Promenade': 'အပူပိုင်း ပင်လယ်ကမ်းလမ်း',
  'Azure ocean skies, golden sand sidewalks, and swaying coconut palms':
    'ပြာနက်သော ပင်လယ်မိုး၊ ရွှေရောင်သဲလမ်းဘေးနှင့် လှုပ်ရှားနေသော ရေမြောပင်များ',
  'Mirage Canyon': 'တာမီး ကျောက်ကြား',
  'Sunset Terracotta Desert': 'နေဝင်ချိန် နီညိုရောင် သဲကန္တာရ',
  'Blazing twilight sunset through towering red canyons and desert cacti':
    'နီရင့်သော ကျောက်သင်းပြင်နှင့် သဲကန္တာရအုတ်ကောင်များကြား မီးနေဝင်ချိန်',
  'Cyber Shibuya': 'ဆိုက်ဘာ ရှိဘျူး',
  'Synthwave Night Metropolis': 'စင်းဝိုင်း ညမြို့ကြီး',
  'Rain-slicked neon highways flanked by holographic skyscrapers & violet haze':
    'မိုးရွာပြီး တောက်ပနေသော နီယွန်လမ်းမကြီးများနှင့် ဟိုလိုဂရပ် အဆောက်အအုံများ',
  'Frosty Alps': 'ဆီးနှင်း အယ်လ်ပ်တောင်',
  'Snowbound Alpine Expressway': 'ဆီးနှင်းဖုံး တောင်ဆင်း လမ်းမကြီး',
  'Sub-zero frosted highways lined with snow-covered pines and swirling flurries':
    'အေးခဲသော လမ်းမကြီးဘေးတွင် ဆီးနှင်းဖုံး ထင်းရှူးပင်များနှင့် ဝဲလွင့်နေသော နှင်းမှုန်များ',
  'Sacred Lantern Way': 'ရှေးဟောင်း မီးအိမ်လမ်း',
  'Cherry Blossom Sanctuary': 'ချယ်ရီပန်း ဘုရားတော',
  'Moonlit cobblestone path guided by glowing crimson lanterns & pink sakura blossoms':
    'လမင်းရောင် ကျောက်ခင်းလမ်းပေါ် နီရောင်မီးအိမ်များနှင့် ပန်းရောင် စံချိမ်းပန်းများ',
  'Sakura Heights': 'ဆာကူရာ ကုန်းမြင့်',
  'Spring Blossom Highlands': 'နွေဦး ပန်းပွင့် ကုန်းမြင့်',
  'A bright spring run through pink blossoms and lantern-lit hills':
    'ပန်းရောင် ပန်းပွင့်များနှင့် မီးအိမ်ရောင် တောင်ကုန်းများကြား တောက်ပနေသော နွေဦး အပြေးပွဲ',
  'Ember Canyon': 'မီးရှူးကျောက်ကြား',
  'Crimson Volcanic Canyon': 'နီရင့်သော မီးတောင် ကျောက်ကြား',
  'Race through a glowing canyon of ember-red stone and volcanic light':
    'မီးခိုးနီ ကျောက်တုံးများနှင့် မီးတောင်အလင်းရောင် ထိုးနေသော ကျောက်ကြားကို ဖြတ်ပြေးပါ',
  'Aurora Ridge': 'အော်ရိုရာ တောင်ကြော',
  'Northern Lights Glacier': 'မြောက်ဘက်အလင်း ရေခဲမြစ်',
  'Glide beneath a dancing aurora across blue-white alpine peaks':
    'ပြာဖြူ တောင်ထိပ်များကြား လှုပ်ရှားနေသော အော်ရိုရာအောက် လျှောဝင်ပြေးပါ',
  'Starlight Shibuya': 'ကြယ်ရောင် ရှိဘျူး',
  'Starlit Neon Metropolis': 'ကြယ်ရောင် နီယွန်မြို့ကြီး',
  'A midnight sprint through a violet skyline under a bright moon':
    'တောက်ပနေသော လမင်းအောက် ခရမ်းရောင် မြို့သစ်ထဲ သန်းခေါင် အပြေးပွဲ',
  'Monsoon Coast': 'မုတ်သုံ ကမ်းခြေ',
  'Emerald Rain Coast': 'စိမ်းစိမ်း မိုးရေကမ်းခြေ',
  'Run beside a deep emerald sea as warm rain sweeps the palms':
    'နွေးထွေးသော မိုးရေက ရေမြောပင်များကို ဖြတ်သန်းနေစဉ် စိမ်းနက်သော ပင်လယ်ဘေးတွင် ပြေးပါ',
  'Moonlit Bazaar': 'လမင်း ဈေးတန်း',
  'Midnight Market Festival': 'သန်းခေါင် ဈေးပွဲတော်',
  'Dash past glowing stalls beneath a deep blue festival sky':
    'နက်ပြာသော ပွဲတော်မိုးအောက် တောက်ပနေသော ဆိုင်တန်းများကို ဖြတ်ပြေးပါ',

  // Biome preview captions inside the map cards
  'BAZAAR BOULEVARD & TOWNHOUSES': 'ဈေးလမ်းမကြီးနှင့် အိမ်များ',
  'CORAL REEF & SURFBOARD': 'သန္တာလင်္ကပ်နှင့် ရိုက်စ်ဘုတ်',
  'VOLCANO & MAGMA CHASM': 'မီးတောင်နှင့် မဂ္ဂာမီးကျောက်ချိုင့်',
  'SYNTHWAVE NEON METROPOLIS': 'စင်းဝိုင်း နီယွန်မြို့ကြီး',
  'FROSTBITE GLACIER PASS': 'ဆီးနှင်း ကျောက်တောင်ကြား',
  'ANCIENT BLOSSOM SANCTUM': 'ရှေးဟောင်း ပန်းပွင့် ဘုရားတော',

  // Dino skins modal (Wardrobe menu)
  '3D DINO PADDOCK': '၃D ဒိုင်နို ဝိုင်း',
  'Select your 3D dinosaur runner for live gameplay':
    'တိုက်ရိုက် ကစားရန် သင့် ၃D ဒိုင်နို ပြေးသမားကို ရွေးပါ',
  'PLAYING AS THIS DINO': 'ဤဒိုင်နိုဖြင့် ကစားနေသည်',
  'SELECT {name}': '{name} ကို ရွေးမည်',
  'Drag to rotate': 'လှည့်ရန် ဆွဲပါ',
  'UNLOCK · {cost} COINS': '{cost} ဒင်္ဂါးဖြင့် ဖွင့်ရန်',
  '+{pct}% Speed': '+{pct}% အမြန်နှုန်း',
  'Base Speed': 'မူလ အမြန်နှုန်း',
  ACTIVE: 'ရွေးထားသည်',

  // Dino skin names & taglines
  'Red Rex': 'နီရောင် ရက်စ်',
  'Fiery crimson T-Rex with a furious party tail-whip':
    'ပြင်းထန်သော အမြီးရိုက်ချက်ရှိ မီးရောင် တီ-ရက်စ်',
  'Blue Spino': 'ပြာရောင် စပိုင်နို',
  'Ocean azure Spinosaurus with super hydro agility':
    'ပင်လယ်ပြာရောင် စပိုင်းနိုဆောရပ်စ်၊ ရေထဲ လျင်မြန်မှု အလွန်ကောင်းသည်',
  'Sunny Raptor': 'နေသာ ရက်ပ်တာ',
  'Speedy golden velociraptor with lightning reflexes':
    'လျှပ်စစ်ကဲ့သို့ တုံ့ပြန်မှုရှိ အမြန် ရွှေရောင် ဗဲလိုစီရာပ်တာ',
  'Emerald Dino': 'စိမ်းပြာ ဒိုင်နို',
  'Jungle-trotting Swiposaur with powerful tail smash':
    'အားကောင်းသော အမြီးရိုက်ချက်ရှိ သစ်တောထဲ ပြေးလွှားသော ဆွီပိုဆောရပ်စ်',
  'Cyber Rex': 'ဆိုက်ဘာ ရက်စ်',
  'High-voltage synthwave brawler with neon purple scales':
    'နီယွန် မဲရောင် အစေ့ပါ စွမ်းအင်မြင့် စင်းဝိုင်း တိုက်ခိုက်သူ',
  'Midnight Rex': 'သြတ်နံနက် ရက်စ်',
  'Obsidian stealth predator that strikes like a phantom':
    'နတ်ဆိုးကဲ့သို့ တိတ်ဆိတ်စွာ ရိုက်ချိုးသော နက်မည်း လိုက်စ်ဘာ',
  'Sakura Rex': 'ဆာကူရာ ရက်စ်',
  'A spring-pink runner from Sakura Heights':
    'ဆာကူရာ ကုန်းမြင့်မှ နွေဦးပန်းရောင် ပြေးသမား',
  'Ember Rex': 'မီးရှူး ရက်စ်',
  'A volcanic runner forged in Ember Canyon':
    'မီးရှူးကျောက်ကြားတွင် ဖြစ်ပေါ်လာသော မီးတောင် ပြေးသမား',
  'Aurora Spino': 'အော်ရိုရာ စပိုင်နို',
  'A glacier-blue runner beneath the northern lights':
    'မြောက်ဘက်အလင်းအောက် ရေခဲပြာရောင် ပြေးသမား',
  'Starlight Raptor': 'ကြယ်ရောင် ရက်ပ်တာ',
  'A violet runner racing under Shibuya stars':
    'ရှိဘျူး ကြယ်များအောက် ပြေးနေသော ခရမ်းရောင် ပြေးသမား',
  'Monsoon Raptor': 'မုတ်သုံ ရက်ပ်တာ',
  'An emerald runner built for the rainy coast':
    'မိုးရေကမ်းခြေအတွက် တည်ဆောက်ထားသော စိမ်းစိမ်း ပြေးသမား',
  'Moonlit Rex': 'လမင်း ရက်စ်',
  'A midnight-blue runner of the moonlit bazaar':
    'လမင်းဈေးတန်း၏ သန်းခေါင်ပြာရောင် ပြေးသမား',
  'Red Rex Classic': 'ရှေးဟောင်း နီရောင် ရက်စ်',
  'Classic crimson runner': 'ရှေးဟောင်း နီရောင် ပြေးသမား',
  'White Phantom Dino': 'ဖြူဖြူဝါ သရဲဒိုင်နို',
  'Crisp white techwear dino with emerald band':
    'စိမ်းပြာ ခါးပတ်ပါ ဖြူသော နည်းပညာအဝတ် ဒိုင်နို',
  'Golden Rex King': 'ရွှေရောင် ရက်စ် ဘုရင်',
  'Championship gold with crown': 'မြတ်စိုးရာဇာ ပါသော ရွှေရောင်',
};

export function t(english: string, vars?: Record<string, string | number>): string {
  const template = currentLanguage === 'my' ? BURMESE[english] ?? english : english;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}
