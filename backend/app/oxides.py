"""
oxides.py
---------
Built-in oxide reference: turns an oxide formula such as "Al2O3" into its
element and molar mass, so nobody ever types chemistry data by hand.

A model's input names (its "features") are checked against this: every input
must be a simple oxide of one element, e.g. SiO2, B2O3, Na2O, CaO, Fe2O3.
"""

import re
from typing import Dict, Optional

# Standard atomic weights (g/mol, IUPAC, rounded) and English names.
ELEMENTS: Dict[str, tuple] = {
    "H": ("Hydrogen", 1.008), "Li": ("Lithium", 6.94), "Be": ("Beryllium", 9.0122),
    "B": ("Boron", 10.81), "C": ("Carbon", 12.011), "N": ("Nitrogen", 14.007),
    "O": ("Oxygen", 15.999), "F": ("Fluorine", 18.998), "Na": ("Sodium", 22.990),
    "Mg": ("Magnesium", 24.305), "Al": ("Aluminium", 26.982), "Si": ("Silicon", 28.085),
    "P": ("Phosphorus", 30.974), "S": ("Sulfur", 32.06), "Cl": ("Chlorine", 35.45),
    "K": ("Potassium", 39.098), "Ca": ("Calcium", 40.078), "Sc": ("Scandium", 44.956),
    "Ti": ("Titanium", 47.867), "V": ("Vanadium", 50.942), "Cr": ("Chromium", 51.996),
    "Mn": ("Manganese", 54.938), "Fe": ("Iron", 55.845), "Co": ("Cobalt", 58.933),
    "Ni": ("Nickel", 58.693), "Cu": ("Copper", 63.546), "Zn": ("Zinc", 65.38),
    "Ga": ("Gallium", 69.723), "Ge": ("Germanium", 72.630), "As": ("Arsenic", 74.922),
    "Se": ("Selenium", 78.971), "Br": ("Bromine", 79.904), "Rb": ("Rubidium", 85.468),
    "Sr": ("Strontium", 87.62), "Y": ("Yttrium", 88.906), "Zr": ("Zirconium", 91.224),
    "Nb": ("Niobium", 92.906), "Mo": ("Molybdenum", 95.95), "Ag": ("Silver", 107.87),
    "Cd": ("Cadmium", 112.41), "In": ("Indium", 114.82), "Sn": ("Tin", 118.71),
    "Sb": ("Antimony", 121.76), "Te": ("Tellurium", 127.60), "I": ("Iodine", 126.90),
    "Cs": ("Caesium", 132.91), "Ba": ("Barium", 137.33), "La": ("Lanthanum", 138.91),
    "Ce": ("Cerium", 140.12), "Pr": ("Praseodymium", 140.91), "Nd": ("Neodymium", 144.24),
    "Sm": ("Samarium", 150.36), "Eu": ("Europium", 151.96), "Gd": ("Gadolinium", 157.25),
    "Tb": ("Terbium", 158.93), "Dy": ("Dysprosium", 162.50), "Ho": ("Holmium", 164.93),
    "Er": ("Erbium", 167.26), "Tm": ("Thulium", 168.93), "Yb": ("Ytterbium", 173.05),
    "Lu": ("Lutetium", 174.97), "Hf": ("Hafnium", 178.49), "Ta": ("Tantalum", 180.95),
    "W": ("Tungsten", 183.84), "Tl": ("Thallium", 204.38), "Pb": ("Lead", 207.2),
    "Bi": ("Bismuth", 208.98), "Th": ("Thorium", 232.04), "U": ("Uranium", 238.03),
}

# Molar masses the original models were built with; kept exactly so existing
# weight % conversions don't shift in the last decimal place.
REFERENCE_MOLAR_MASSES = {
    "SiO2": 60.084,
    "B2O3": 69.620,
    "Na2O": 61.979,
}

_TOKEN = re.compile(r"([A-Z][a-z]?)(\d*)")


def parse_oxide(formula: str) -> Optional[Dict]:
    """
    "Al2O3" -> {"formula": "Al2O3", "element": "Al", "element_name": "Aluminium", "molar_mass": 101.961}
    Returns None when the text isn't a simple oxide of one known element.
    """
    if not isinstance(formula, str):
        return None
    text = formula.strip()
    if not text or _TOKEN.sub("", text):  # leftover characters: not a plain formula
        return None
    counts: Dict[str, int] = {}
    for symbol, n in _TOKEN.findall(text):
        if symbol not in ELEMENTS:
            return None
        counts[symbol] = counts.get(symbol, 0) + (int(n) if n else 1)
    others = [s for s in counts if s != "O"]
    if "O" not in counts or len(others) != 1:
        return None
    element = others[0]
    mass = sum(ELEMENTS[s][1] * n for s, n in counts.items())
    return {
        "formula": text,
        "element": element,
        "element_name": ELEMENTS[element][0],
        "molar_mass": round(REFERENCE_MOLAR_MASSES.get(text, mass), 3),
    }


def molar_mass(formula: str) -> float:
    """Molar mass in g/mol; raises ValueError for anything that isn't a simple oxide."""
    info = parse_oxide(formula)
    if info is None:
        raise ValueError(f"'{formula}' is not an oxide the platform recognises.")
    return info["molar_mass"]
