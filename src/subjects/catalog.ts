import { NLM_CATEGORIES, NLM_COMPONENTS, type Comp } from './nlm';

// Optional subject helpers. Pick Menu > Subject > Physics > Class > Chapter and a button for that
// chapter appears on the toolbar; it opens a tray of ready-made pieces to drag onto the board.

export interface Chapter {
  id: string;
  name: string;
  /** Short name on the toolbar button. */
  short: string;
  /** Pieces for this chapter (none yet = "coming soon"). */
  cats?: string[];
  comps?: Comp[];
  /** Ids of the most used pieces: shown as small symbols on the dock next to the toolbar. */
  quick?: string[];
}

export interface Subject {
  id: string;
  name: string;
  classes: { id: string; name: string; chapters: Chapter[] }[];
}

const soon = (names: string[], cls: string): Chapter[] => names.map((n, i) => ({ id: `phy-${cls}-${i + 1}`, name: n, short: n }));

const CLASS11 = [
  'Units and Measurements',
  'Motion in a Straight Line',
  'Motion in a Plane',
  'Laws of Motion',
  'Work, Energy and Power',
  'System of Particles and Rotational Motion',
  'Gravitation',
  'Mechanical Properties of Solids',
  'Mechanical Properties of Fluids',
  'Thermal Properties of Matter',
  'Thermodynamics',
  'Kinetic Theory',
  'Oscillations',
  'Waves',
];
const CLASS12 = [
  'Electric Charges and Fields',
  'Electrostatic Potential and Capacitance',
  'Current Electricity',
  'Moving Charges and Magnetism',
  'Magnetism and Matter',
  'Electromagnetic Induction',
  'Alternating Current',
  'Electromagnetic Waves',
  'Ray Optics and Optical Instruments',
  'Wave Optics',
  'Dual Nature of Radiation and Matter',
  'Atoms',
  'Nuclei',
  'Semiconductor Electronics',
];

const c11 = soon(CLASS11, '11');
// Chapter 4: Laws of Motion (Newton's laws) has its pieces ready.
c11[3] = { id: 'phy-11-nlm', name: "Laws of Motion (Newton's laws)", short: 'NLM', cats: NLM_CATEGORIES, comps: NLM_COMPONENTS, quick: ['b1', 'w30', 'sp', 'p0', 'p1', 'ground', 'ceil', 'wall', 'rope', 'f', 'w', 'n', 't', 'fr', 'atw', 'tab', 'w37', 'mk'] };

export const SUBJECTS: Subject[] = [
  {
    id: 'physics',
    name: 'Physics',
    classes: [
      { id: '11', name: 'Class 11', chapters: c11 },
      { id: '12', name: 'Class 12', chapters: soon(CLASS12, '12') },
    ],
  },
];

/** Find a chapter by its id (the one saved in the settings). */
export function chapterById(id: string | null | undefined): { subject: Subject; chapter: Chapter } | null {
  if (!id) return null;
  for (const s of SUBJECTS) for (const c of s.classes) for (const ch of c.chapters) if (ch.id === id) return { subject: s, chapter: ch };
  return null;
}
