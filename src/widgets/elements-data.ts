// Periodic table data: symbol|name|atomic mass for Z = 1..118.
const RAW = `H|Hydrogen|1.008 He|Helium|4.0026 Li|Lithium|6.94 Be|Beryllium|9.0122 B|Boron|10.81 C|Carbon|12.011 N|Nitrogen|14.007 O|Oxygen|15.999 F|Fluorine|18.998 Ne|Neon|20.180 Na|Sodium|22.990 Mg|Magnesium|24.305 Al|Aluminium|26.982 Si|Silicon|28.085 P|Phosphorus|30.974 S|Sulfur|32.06 Cl|Chlorine|35.45 Ar|Argon|39.948 K|Potassium|39.098 Ca|Calcium|40.078 Sc|Scandium|44.956 Ti|Titanium|47.867 V|Vanadium|50.942 Cr|Chromium|51.996 Mn|Manganese|54.938 Fe|Iron|55.845 Co|Cobalt|58.933 Ni|Nickel|58.693 Cu|Copper|63.546 Zn|Zinc|65.38 Ga|Gallium|69.723 Ge|Germanium|72.630 As|Arsenic|74.922 Se|Selenium|78.971 Br|Bromine|79.904 Kr|Krypton|83.798 Rb|Rubidium|85.468 Sr|Strontium|87.62 Y|Yttrium|88.906 Zr|Zirconium|91.224 Nb|Niobium|92.906 Mo|Molybdenum|95.95 Tc|Technetium|98 Ru|Ruthenium|101.07 Rh|Rhodium|102.91 Pd|Palladium|106.42 Ag|Silver|107.87 Cd|Cadmium|112.41 In|Indium|114.82 Sn|Tin|118.71 Sb|Antimony|121.76 Te|Tellurium|127.60 I|Iodine|126.90 Xe|Xenon|131.29 Cs|Caesium|132.91 Ba|Barium|137.33 La|Lanthanum|138.91 Ce|Cerium|140.12 Pr|Praseodymium|140.91 Nd|Neodymium|144.24 Pm|Promethium|145 Sm|Samarium|150.36 Eu|Europium|151.96 Gd|Gadolinium|157.25 Tb|Terbium|158.93 Dy|Dysprosium|162.50 Ho|Holmium|164.93 Er|Erbium|167.26 Tm|Thulium|168.93 Yb|Ytterbium|173.05 Lu|Lutetium|174.97 Hf|Hafnium|178.49 Ta|Tantalum|180.95 W|Tungsten|183.84 Re|Rhenium|186.21 Os|Osmium|190.23 Ir|Iridium|192.22 Pt|Platinum|195.08 Au|Gold|196.97 Hg|Mercury|200.59 Tl|Thallium|204.38 Pb|Lead|207.2 Bi|Bismuth|208.98 Po|Polonium|209 At|Astatine|210 Rn|Radon|222 Fr|Francium|223 Ra|Radium|226 Ac|Actinium|227 Th|Thorium|232.04 Pa|Protactinium|231.04 U|Uranium|238.03 Np|Neptunium|237 Pu|Plutonium|244 Am|Americium|243 Cm|Curium|247 Bk|Berkelium|247 Cf|Californium|251 Es|Einsteinium|252 Fm|Fermium|257 Md|Mendelevium|258 No|Nobelium|259 Lr|Lawrencium|266 Rf|Rutherfordium|267 Db|Dubnium|268 Sg|Seaborgium|269 Bh|Bohrium|270 Hs|Hassium|277 Mt|Meitnerium|278 Ds|Darmstadtium|281 Rg|Roentgenium|282 Cn|Copernicium|285 Nh|Nihonium|286 Fl|Flerovium|289 Mc|Moscovium|290 Lv|Livermorium|293 Ts|Tennessine|294 Og|Oganesson|294`;

export type ChemCategory =
  | 'nonmetal'
  | 'noble'
  | 'alkali'
  | 'alkaline'
  | 'metalloid'
  | 'halogen'
  | 'post'
  | 'transition'
  | 'lanthanide'
  | 'actinide';

export interface ChemElement {
  z: number;
  sym: string;
  name: string;
  mass: string;
  cat: ChemCategory;
  col: number;
  row: number;
}

export const CATEGORY_COLORS: Record<ChemCategory, string> = {
  nonmetal: '#4ade80',
  noble: '#c084fc',
  alkali: '#f87171',
  alkaline: '#fb923c',
  metalloid: '#2dd4bf',
  halogen: '#facc15',
  post: '#94a3b8',
  transition: '#60a5fa',
  lanthanide: '#f472b6',
  actinide: '#e879f9',
};

export const CATEGORY_NAMES: Record<ChemCategory, string> = {
  nonmetal: 'Reactive nonmetal',
  noble: 'Noble gas',
  alkali: 'Alkali metal',
  alkaline: 'Alkaline earth metal',
  metalloid: 'Metalloid',
  halogen: 'Halogen',
  post: 'Post-transition metal',
  transition: 'Transition metal',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
};

function category(z: number): ChemCategory {
  if ([2, 10, 18, 36, 54, 86, 118].includes(z)) return 'noble';
  if ([9, 17, 35, 53, 85, 117].includes(z)) return 'halogen';
  if ([1, 6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
  if ([3, 11, 19, 37, 55, 87].includes(z)) return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z)) return 'alkaline';
  if ([5, 14, 32, 33, 51, 52].includes(z)) return 'metalloid';
  if (z >= 57 && z <= 71) return 'lanthanide';
  if (z >= 89 && z <= 103) return 'actinide';
  if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 'post';
  return 'transition';
}

function position(z: number): [number, number] {
  if (z === 1) return [1, 1];
  if (z === 2) return [18, 1];
  const periods: [number, number, number][] = [
    [3, 10, 2],
    [11, 18, 3],
  ];
  for (const [a, b, row] of periods) {
    if (z >= a && z <= b) {
      const i = z - a;
      return [i < 2 ? i + 1 : i + 11, row];
    }
  }
  if (z >= 19 && z <= 36) return [z - 18, 4];
  if (z >= 37 && z <= 54) return [z - 36, 5];
  if (z === 55 || z === 56) return [z - 54, 6];
  if (z >= 57 && z <= 71) return [z - 54, 9];
  if (z >= 72 && z <= 86) return [z - 68, 6];
  if (z === 87 || z === 88) return [z - 86, 7];
  if (z >= 89 && z <= 103) return [z - 86, 10];
  return [z - 100, 7];
}

export const ELEMENTS: ChemElement[] = RAW.split(' ').map((s, i) => {
  const [sym, name, mass] = s.split('|');
  const z = i + 1;
  const [col, row] = position(z);
  return { z, sym, name, mass, cat: category(z), col, row };
});
