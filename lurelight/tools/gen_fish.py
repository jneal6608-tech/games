#!/usr/bin/env python3
"""Make the art for the unlockable fish by recolouring the base anglerfish (assets/art/fish_body.svg, fish_tail.svg).
Usage: python3 tools/gen_fish.py      (then run `godot --headless --path . --import`)"""
import pathlib

ART = pathlib.Path(__file__).resolve().parent.parent / "assets" / "art"
# base colour -> replacement: body light / mid / dark, mouth, fin light / dark, belly sheen
PALETTES = {
    "brute": {"#9A5BC0": "#F09A52", "#5A2A82": "#A84A1E", "#2A1142": "#42180A", "#3D1A5C": "#4A1A0C",
              "#FF8FB8": "#FFD27A", "#A8468C": "#C8641E", "#FF9EC4": "#FFD9A0"},
    "whip": {"#9A5BC0": "#7CEAF0", "#5A2A82": "#1F8FA6", "#2A1142": "#0A3550", "#3D1A5C": "#0B3148",
             "#FF8FB8": "#D6FFF4", "#A8468C": "#46B4C4", "#FF9EC4": "#C8FFF8"},
    "twin": {"#9A5BC0": "#F07AD6", "#5A2A82": "#8A2AA8", "#2A1142": "#2C0F58", "#3D1A5C": "#3A1466",
             "#FF8FB8": "#9AE8FF", "#A8468C": "#4A7ED0", "#FF9EC4": "#FFC0F0"},
}
for name, pal in PALETTES.items():
    for part in ("fish_body", "fish_tail"):
        svg = (ART / f"{part}.svg").read_text()
        for a, b in pal.items():
            svg = svg.replace(a, b)
        (ART / f"{part}_{name}.svg").write_text(svg)
        print("wrote", f"{part}_{name}.svg")
