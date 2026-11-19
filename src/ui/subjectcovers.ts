// Subject covers: 12 subjects x 20 covers, in the same calm style as the first covers (flat colour, one fine
// line drawing, a short rule and the name). Nothing is downloaded: every drawing is a few lines of SVG
// (drawn in black and used as a mask, so one drawing works in every ink colour).
//
// A cover is a drawing (6 per subject) in a colour pair (20 pairs). Cover number i of a subject uses
// drawing i % 6, placement floor(i / 6) (4 placements) and colour pair (i * 7 + shift) % 20: 7 and 20 share
// no factor, so the 20 colour pairs of a subject are all different, and so are drawing + placement.

import type { Art } from './art/kit';
import { PHYSICS } from './art/phy';
import { CHEMISTRY } from './art/che';
import { MATHS } from './art/mat';
import { HISTORY } from './art/his';
import { GEOGRAPHY } from './art/geo';
import { SOCIAL } from './art/soc';
import { DRAWING } from './art/dra';
import { ZOOLOGY } from './art/zoo';
import { BOTANY } from './art/bot';
import { ENGLISH } from './art/eng';
import { COMPUTER } from './art/com';
import { ECONOMICS } from './art/eco';

export interface SubjectCover {
  id: string;
  name: string;
  bg: string;
  ink: string;
  group: string;
  /** Which drawing ("phy:3") and which colour pair (0-19). */
  drawing: string;
  pair: number;
  /** The layout of the cover (0-9, see the stylesheet). */
  style: number;
  /** Second colour of the cover. */
  bg2: string;
}

export interface CoverGroup {
  id: string;
  name: string;
}


// ---- the drawings: 100 x 100, black lines -------------------------------------------------------














// ---- colours: 20 pairs (cover colour, ink) --------------------------------------------------

const PAIRS: [string, string, string][] = [
  // cover colour, second colour (the cover fades into it), ink
  ['#0f1c3a', '#1d3b78', '#ffffff'], ['#0b5d56', '#14a094', '#ffffff'], ['#3b1f5e', '#7a3fa8', '#ffffff'], ['#0d0d12', '#2a2a36', '#e9c46a'],
  ['#1740a8', '#2f7bf0', '#ffffff'], ['#2f5d46', '#5c9a78', '#f6f3e8'], ['#a8405e', '#e0708f', '#ffffff'], ['#123d27', '#2c7a52', '#eaf5df'],
  ['#8f1f1a', '#d6453a', '#ffffff'], ['#262b36', '#4a5266', '#ffffff'], ['#2b2880', '#5a52d8', '#ffffff'], ['#efe4cc', '#fbf5e6', '#3a2e1a'],
  ['#e9a62f', '#f6cd6a', '#2b2110'], ['#7fcfc3', '#bdeee6', '#0d3b36'], ['#e0603f', '#f59a6e', '#ffffff'], ['#c3a8f2', '#e6d9ff', '#2d1b4e'],
  ['#cfc596', '#ece6c4', '#37341a'], ['#050507', '#17171d', '#ffffff'], ['#6b1633', '#b2315f', '#ffe3ec'], ['#1f6fae', '#4aa6e8', '#ffffff'],
];

const GROUPS: { id: string; name: string; art: Art[]; shift: number }[] = [
  { id: 'phy', name: 'Physics', art: PHYSICS, shift: 0 },
  { id: 'che', name: 'Chemistry', art: CHEMISTRY, shift: 3 },
  { id: 'mat', name: 'Maths', art: MATHS, shift: 6 },
  { id: 'his', name: 'History', art: HISTORY, shift: 9 },
  { id: 'geo', name: 'Geography', art: GEOGRAPHY, shift: 12 },
  { id: 'soc', name: 'Social science', art: SOCIAL, shift: 15 },
  { id: 'dra', name: 'Drawing', art: DRAWING, shift: 18 },
  { id: 'zoo', name: 'Zoology', art: ZOOLOGY, shift: 1 },
  { id: 'bot', name: 'Botany', art: BOTANY, shift: 4 },
  { id: 'eng', name: 'English', art: ENGLISH, shift: 7 },
  { id: 'com', name: 'Computer', art: COMPUTER, shift: 10 },
  { id: 'eco', name: 'Economics', art: ECONOMICS, shift: 13 },
];

export const SUBJECT_GROUPS: CoverGroup[] = GROUPS.map((g) => ({ id: g.id, name: g.name }));

const pic = (body: string): string => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${body}</svg>`).replace(/'/g, '%27')}")`;

/** The picture of one drawing, e.g. key "phy:3" (built when first needed). */
const drawn = new Map<string, string>();
export function drawingUrl(key: string): string {
  let a = drawn.get(key);
  if (!a) {
    const [gid, k] = key.split(':');
    a = pic(GROUPS.find((g) => g.id === gid)!.art[Number(k)]());
    drawn.set(key, a);
  }
  return a;
}

/**
 * All 240 covers. Cover i of a subject: layout i % 10 (ten layouts), drawing (i + 3 * floor(i / 10)) % 8 (eight drawings)
 * and colour pair (i * 7 + shift) % 20. Two covers with the same layout always have different drawings, and all 20
 * colour pairs of a subject differ, so no two covers of a subject look alike.
 */
export const SUBJECT_COVERS: SubjectCover[] = GROUPS.flatMap((g) =>
  Array.from({ length: 20 }, (_, i) => {
    const pair = (i * 7 + g.shift) % 20;
    return {
      id: `${g.id}-${String(i + 1).padStart(2, '0')}`,
      name: `${g.name} ${i + 1}`,
      group: g.id,
      drawing: `${g.id}:${(i + 3 * Math.floor(i / 10)) % g.art.length}`,
      style: i % 10,
      pair,
      bg: PAIRS[pair][0],
      bg2: PAIRS[pair][1],
      ink: PAIRS[pair][2],
    };
  }),
);

export const COVER_PAIRS = PAIRS;

export function subjectCoverById(id: string | undefined): SubjectCover | undefined {
  return id ? SUBJECT_COVERS.find((c) => c.id === id) : undefined;
}
