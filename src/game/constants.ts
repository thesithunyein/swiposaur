import { CharacterSkin, BystanderType } from './types.ts';

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 'rex_red',
    name: 'Red Rex',
    tagline: 'Fiery crimson T-Rex with a furious party tail-whip',
    bodyColor: '#EF4444',
    shirtColor: '#FEF3C7',
    pantsColor: '#B91C1C',
    hat: 'none',
    speedBonus: 0,
    cost: 0,
  },
  {
    id: 'spino_blue',
    name: 'Blue Spino',
    tagline: 'Ocean azure Spinosaurus with super hydro agility',
    bodyColor: '#0284C7',
    shirtColor: '#E0F2FE',
    pantsColor: '#0369A1',
    hat: 'headband',
    speedBonus: 0.1,
    cost: 150,
  },
  {
    id: 'raptor_gold',
    name: 'Sunny Raptor',
    tagline: 'Speedy golden velociraptor with lightning reflexes',
    bodyColor: '#F59E0B',
    shirtColor: '#FFFBEB',
    pantsColor: '#D97706',
    hat: 'crown',
    speedBonus: 0.15,
    cost: 350,
  },
  {
    id: 'dino_green',
    name: 'Emerald Dino',
    tagline: 'Jungle-trotting Swiposaur with powerful tail smash',
    bodyColor: '#10B981',
    shirtColor: '#D1FAE5',
    pantsColor: '#047857',
    hat: 'cap',
    speedBonus: 0.2,
    cost: 500,
  },
  {
    id: 'cyber_dino',
    name: 'Cyber Rex',
    tagline: 'High-voltage synthwave brawler with neon purple scales',
    bodyColor: '#8B5CF6',
    shirtColor: '#06B6D4',
    pantsColor: '#4C1D95',
    hat: 'headband',
    speedBonus: 0.22,
    cost: 750,
  },
  {
    id: 'shadow_rex',
    name: 'Midnight Rex',
    tagline: 'Obsidian stealth predator that strikes like a phantom',
    bodyColor: '#1E293B',
    shirtColor: '#F43F5E',
    pantsColor: '#0F172A',
    hat: 'headband',
    speedBonus: 0.25,
    cost: 1000,
  },
  // Backward compatibility aliases
  {
    id: 'speedy_dash',
    name: 'Red Rex Classic',
    tagline: 'Classic crimson runner',
    bodyColor: '#EF4444',
    shirtColor: '#FEF3C7',
    pantsColor: '#B91C1C',
    hat: 'cap',
    speedBonus: 0,
    cost: 0,
  },
  {
    id: 'market_ninja',
    name: 'White Phantom Dino',
    tagline: 'Crisp white techwear dino with emerald band',
    bodyColor: '#E6A885',
    shirtColor: '#FFFFFF',
    pantsColor: '#0F172A',
    hat: 'headband',
    speedBonus: 0.1,
    cost: 150,
  },
  {
    id: 'golden_champ',
    name: 'Golden Rex King',
    tagline: 'Championship gold with crown',
    bodyColor: '#BA8063',
    shirtColor: '#F59E0B',
    pantsColor: '#FFFFFF',
    hat: 'crown',
    speedBonus: 0.15,
    cost: 350,
  },
];

export interface BystanderTemplate {
  type: BystanderType;
  name: string;
  points: number;
  bodyColor: string;
  shirtColor: string;
  accessory: 'hat' | 'glasses' | 'phone' | 'fish' | 'fruit';
  shouts: string[];
}

export const BYSTANDER_TEMPLATES: BystanderTemplate[] = [
  {
    type: 'fruitseller',
    name: 'Melon Stand',
    points: 150,
    bodyColor: '#EF4444',
    shirtColor: '#10B981',
    accessory: 'fruit',
    shouts: ['JUICY!', 'SWEET SPLAT!', 'BONUS!'],
  },
  {
    type: 'fishmonger',
    name: 'Coconut Pinata',
    points: 200,
    bodyColor: '#78350F',
    shirtColor: '#FDE047',
    accessory: 'fish',
    shouts: ['CRUNCH!', 'BONK!', 'POW!'],
  },
  {
    type: 'bouncer',
    name: 'Tiki Totem',
    points: 250,
    bodyColor: '#854D0E',
    shirtColor: '#F97316',
    accessory: 'glasses',
    shouts: ['CRACK!', 'SMASH!', 'BOOM!'],
  },
  {
    type: 'influencer',
    name: 'Party Balloons',
    points: 120,
    bodyColor: '#EC4899',
    shirtColor: '#38BDF8',
    accessory: 'phone',
    shouts: ['POP!', 'CONFETTI!', 'PARTY!'],
  },
  {
    type: 'salaryman',
    name: 'Golden Dino Nest',
    points: 180,
    bodyColor: '#F59E0B',
    shirtColor: '#FEF08A',
    accessory: 'hat',
    shouts: ['SHINY!', 'EGG BONUS!', 'JACKPOT!'],
  },
];

export const COMIC_WORDS = ['TAIL-WHIP!', 'JUICY!', 'CRUNCH!', 'WHACK!', 'BONK!', 'SMASH!', 'ROAR!'];

export const ROAD_WIDTH = 280; // Fast 3-lane market road (-140 to 140)
export const ROAD_LANES = [-90, 0, 90]; // 3 cleanly aligned lanes: Left (-90), Center (0), Right (90)
export const SIDEWALK_EDGES = [-140, 140]; // Curb edge hazards
// The whip has to cross two lanes when the runner hugs one curb: a walker on
// the far sidewalk can stand 253 units sideways (x = ±163 against lane ±90),
// and at the front of the cue (dy = 112) that is ~277 away. 282 covers the
// whole cue window from every lane, so no glowing walker is out of reach.
export const SLAP_REACH = 282;
export const MOB_SAFE_DISTANCE = 45; // Minimum distance before mob catches player

/**
 * Touch builds run on a slightly wider street: same three lanes, just about
 * 12% more breathing room between them. Everything downstream — the road
 * clamp, the lane dashes, the sidewalk bystanders stand on — derives from
 * these values, and the keyboard build keeps the original numbers untouched.
 */
export const TOUCH_ROAD_SCALE = 1.12;
export const TOUCH_ROAD_WIDTH = Math.round(ROAD_WIDTH * TOUCH_ROAD_SCALE); // 314
export const TOUCH_ROAD_LANES = ROAD_LANES.map((lane) => Math.round(lane * TOUCH_ROAD_SCALE)); // [-101, 0, 101]

/**
 * On the wider street the far curb sits at ±157.5 and a walker can stand at
 * ±180.5, so the worst cross-road cue (lane -101 against walker 180.5 at dy
 * 112) is ~303 units. 310 keeps every glowing walker reachable on touch;
 * desktop keeps the tuned 282.
 */
export const TOUCH_SLAP_REACH = 310;
