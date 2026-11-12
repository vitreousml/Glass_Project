export interface ElementData {
  symbol: string;
  name: string;
  number: number;
  category: string;
  row: number;
  col: number;
  supported?: boolean;
  implicit?: boolean;
  oxide?: string;
}

export const PERIODIC_ELEMENTS: ElementData[] = [
  // Period 1
  { number: 1, symbol: "H", name: "Hydrogen", category: "nonmetal", row: 1, col: 1 },
  { number: 2, symbol: "He", name: "Helium", category: "noble", row: 1, col: 18 },

  // Period 2
  { number: 3, symbol: "Li", name: "Lithium", category: "alkali", row: 2, col: 1 },
  { number: 4, symbol: "Be", name: "Beryllium", category: "alkaline", row: 2, col: 2 },
  { number: 5, symbol: "B", name: "Boron", category: "metalloid", row: 2, col: 13, supported: true, oxide: "B2O3" },
  { number: 6, symbol: "C", name: "Carbon", category: "nonmetal", row: 2, col: 14 },
  { number: 7, symbol: "N", name: "Nitrogen", category: "nonmetal", row: 2, col: 15 },
  { number: 8, symbol: "O", name: "Oxygen", category: "nonmetal", row: 2, col: 16, implicit: true, oxide: "Oxide Matrix" },
  { number: 9, symbol: "F", name: "Fluorine", category: "halogen", row: 2, col: 17 },
  { number: 10, symbol: "Ne", name: "Neon", category: "noble", row: 2, col: 18 },

  // Period 3
  { number: 11, symbol: "Na", name: "Sodium", category: "alkali", row: 3, col: 1, supported: true, oxide: "Na2O" },
  { number: 12, symbol: "Mg", name: "Magnesium", category: "alkaline", row: 3, col: 2 },
  { number: 13, symbol: "Al", name: "Aluminium", category: "post-transition", row: 3, col: 13 },
  { number: 14, symbol: "Si", name: "Silicon", category: "metalloid", row: 3, col: 14, supported: true, oxide: "SiO2" },
  { number: 15, symbol: "P", name: "Phosphorus", category: "nonmetal", row: 3, col: 15 },
  { number: 16, symbol: "S", name: "Sulfur", category: "nonmetal", row: 3, col: 16 },
  { number: 17, symbol: "Cl", name: "Chlorine", category: "halogen", row: 3, col: 17 },
  { number: 18, symbol: "Ar", name: "Argon", category: "noble", row: 3, col: 18 },

  // Period 4
  { number: 19, symbol: "K", name: "Potassium", category: "alkali", row: 4, col: 1 },
  { number: 20, symbol: "Ca", name: "Calcium", category: "alkaline", row: 4, col: 2 },
  { number: 21, symbol: "Sc", name: "Scandium", category: "transition", row: 4, col: 3 },
  { number: 22, symbol: "Ti", name: "Titanium", category: "transition", row: 4, col: 4 },
  { number: 23, symbol: "V", name: "Vanadium", category: "transition", row: 4, col: 5 },
  { number: 24, symbol: "Cr", name: "Chromium", category: "transition", row: 4, col: 6 },
  { number: 25, symbol: "Mn", name: "Manganese", category: "transition", row: 4, col: 7 },
  { number: 26, symbol: "Fe", name: "Iron", category: "transition", row: 4, col: 8 },
  { number: 27, symbol: "Co", name: "Cobalt", category: "transition", row: 4, col: 9 },
  { number: 28, symbol: "Ni", name: "Nickel", category: "transition", row: 4, col: 10 },
  { number: 29, symbol: "Cu", name: "Copper", category: "transition", row: 4, col: 11 },
  { number: 30, symbol: "Zn", name: "Zinc", category: "transition", row: 4, col: 12 },
  { number: 31, symbol: "Ga", name: "Gallium", category: "post-transition", row: 4, col: 13 },
  { number: 32, symbol: "Ge", name: "Germanium", category: "metalloid", row: 4, col: 14 },
  { number: 33, symbol: "As", name: "Arsenic", category: "metalloid", row: 4, col: 15 },
  { number: 34, symbol: "Se", name: "Selenium", category: "nonmetal", row: 4, col: 16 },
  { number: 35, symbol: "Br", name: "Bromine", category: "halogen", row: 4, col: 17 },
  { number: 36, symbol: "Kr", name: "Krypton", category: "noble", row: 4, col: 18 },

  // Period 5
  { number: 37, symbol: "Rb", name: "Rubidium", category: "alkali", row: 5, col: 1 },
  { number: 38, symbol: "Sr", name: "Strontium", category: "alkaline", row: 5, col: 2 },
  { number: 39, symbol: "Y", name: "Yttrium", category: "transition", row: 5, col: 3 },
  { number: 40, symbol: "Zr", name: "Zirconium", category: "transition", row: 5, col: 4 },
  { number: 41, symbol: "Nb", name: "Niobium", category: "transition", row: 5, col: 5 },
  { number: 42, symbol: "Mo", name: "Molybdenum", category: "transition", row: 5, col: 6 },
  { number: 43, symbol: "Tc", name: "Technetium", category: "transition", row: 5, col: 7 },
  { number: 44, symbol: "Ru", name: "Ruthenium", category: "transition", row: 5, col: 8 },
  { number: 45, symbol: "Rh", name: "Rhodium", category: "transition", row: 5, col: 9 },
  { number: 46, symbol: "Pd", name: "Palladium", category: "transition", row: 5, col: 10 },
  { number: 47, symbol: "Ag", name: "Silver", category: "transition", row: 5, col: 11 },
  { number: 48, symbol: "Cd", name: "Cadmium", category: "transition", row: 5, col: 12 },
  { number: 49, symbol: "In", name: "Indium", category: "post-transition", row: 5, col: 13 },
  { number: 50, symbol: "Sn", name: "Tin", category: "post-transition", row: 5, col: 14 },
  { number: 51, symbol: "Sb", name: "Antimony", category: "metalloid", row: 5, col: 15 },
  { number: 52, symbol: "Te", name: "Tellurium", category: "metalloid", row: 5, col: 16 },
  { number: 53, symbol: "I", name: "Iodine", category: "halogen", row: 5, col: 17 },
  { number: 54, symbol: "Xe", name: "Xenon", category: "noble", row: 5, col: 18 },

  // Period 6
  { number: 55, symbol: "Cs", name: "Caesium", category: "alkali", row: 6, col: 1 },
  { number: 56, symbol: "Ba", name: "Barium", category: "alkaline", row: 6, col: 2 },
  { number: 57, symbol: "La", name: "Lanthanum", category: "lanthanide", row: 8, col: 3 },
  { number: 72, symbol: "Hf", name: "Hafnium", category: "transition", row: 6, col: 4 },
  { number: 73, symbol: "Ta", name: "Tantalum", category: "transition", row: 6, col: 5 },
  { number: 74, symbol: "W", name: "Tungsten", category: "transition", row: 6, col: 6 },
  { number: 75, symbol: "Re", name: "Rhenium", category: "transition", row: 6, col: 7 },
  { number: 76, symbol: "Os", name: "Osmium", category: "transition", row: 6, col: 8 },
  { number: 77, symbol: "Ir", name: "Iridium", category: "transition", row: 6, col: 9 },
  { number: 78, symbol: "Pt", name: "Platinum", category: "transition", row: 6, col: 10 },
  { number: 79, symbol: "Au", name: "Gold", category: "transition", row: 6, col: 11 },
  { number: 80, symbol: "Hg", name: "Mercury", category: "transition", row: 6, col: 12 },
  { number: 81, symbol: "Tl", name: "Thallium", category: "post-transition", row: 6, col: 13 },
  { number: 82, symbol: "Pb", name: "Lead", category: "post-transition", row: 6, col: 14 },
  { number: 83, symbol: "Bi", name: "Bismuth", category: "post-transition", row: 6, col: 15 },
  { number: 84, symbol: "Po", name: "Polonium", category: "post-transition", row: 6, col: 16 },
  { number: 85, symbol: "At", name: "Astatine", category: "halogen", row: 6, col: 17 },
  { number: 86, symbol: "Rn", name: "Radon", category: "noble", row: 6, col: 18 },

  // Period 7
  { number: 87, symbol: "Fr", name: "Francium", category: "alkali", row: 7, col: 1 },
  { number: 88, symbol: "Ra", name: "Radium", category: "alkaline", row: 7, col: 2 },
  { number: 89, symbol: "Ac", name: "Actinium", category: "actinide", row: 9, col: 3 },
  { number: 104, symbol: "Rf", name: "Rutherfordium", category: "transition", row: 7, col: 4 },
  { number: 105, symbol: "Db", name: "Dubnium", category: "transition", row: 7, col: 5 },
  { number: 106, symbol: "Sg", name: "Seaborgium", category: "transition", row: 7, col: 6 },
  { number: 107, symbol: "Bh", name: "Bohrium", category: "transition", row: 7, col: 7 },
  { number: 108, symbol: "Hs", name: "Hassium", category: "transition", row: 7, col: 8 },
  { number: 109, symbol: "Mt", name: "Meitnerium", category: "transition", row: 7, col: 9 },
  { number: 110, symbol: "Ds", name: "Darmstadtium", category: "transition", row: 7, col: 10 },
  { number: 111, symbol: "Rg", name: "Roentgenium", category: "transition", row: 7, col: 11 },
  { number: 112, symbol: "Cn", name: "Copernicium", category: "transition", row: 7, col: 12 },
  { number: 113, symbol: "Nh", name: "Nihonium", category: "post-transition", row: 7, col: 13 },
  { number: 114, symbol: "Fl", name: "Flerovium", category: "post-transition", row: 7, col: 14 },
  { number: 115, symbol: "Mc", name: "Moscovium", category: "post-transition", row: 7, col: 15 },
  { number: 116, symbol: "Lv", name: "Livermorium", category: "post-transition", row: 7, col: 16 },
  { number: 117, symbol: "Ts", name: "Tennessine", category: "halogen", row: 7, col: 17 },
  { number: 118, symbol: "Og", name: "Oganesson", category: "noble", row: 7, col: 18 },
];

