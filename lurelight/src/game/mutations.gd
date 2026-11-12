class_name Mutations
## Upgrade definitions. Every weapon mutation changes how the lure looks, so a run's build is visible on screen.

const LIST := {
	&"heavy": {"name": "Heavy Lure", "max": 4, "weight": 3.0, "desc": "Bigger lure. +35% damage.", "color": Color("ffd86b")},
	&"stalk": {"name": "Long Stalk", "max": 4, "weight": 3.0, "desc": "+18% reach. Longer swings hit faster.", "color": Color("c05a9a")},
	&"twin": {"name": "Twin Lure", "max": 2, "weight": 2.2, "desc": "Grow another lure.", "color": Color("6be8ff")},
	&"pulse": {"name": "Shock Pulse", "max": 4, "weight": 2.4, "desc": "Lures burst with a shockwave every few seconds.", "color": Color("6be8ff")},
	&"toxic": {"name": "Toxic Trail", "max": 4, "weight": 2.4, "desc": "A fast lure leaves burning poison behind.", "color": Color("9dff5c")},
	&"barbs": {"name": "Barbs", "max": 3, "weight": 2.2, "desc": "+18% chance of a critical hit (x2.5).", "color": Color("fff6e0")},
	&"chain": {"name": "Spark Chain", "max": 4, "weight": 2.2, "desc": "Kills arc lightning to nearby creatures.", "color": Color("a8b8ff")},
	&"crack": {"name": "Whipcrack", "max": 3, "weight": 2.2, "desc": "Swing at full speed to fire a cutting wave.", "color": Color("ffffff")},
	&"magnet": {"name": "Glow Bait", "max": 3, "weight": 1.6, "desc": "+45% pickup range.", "color": Color("7cffcb")},
	&"fins": {"name": "Swift Fins", "max": 3, "weight": 1.6, "desc": "+10% swim speed.", "color": Color("ff8fb8")},
	&"scales": {"name": "Thick Scales", "max": 3, "weight": 1.5, "desc": "+1 heart, and heal one.", "color": Color("ff5470")},
}

const FILLERS := {
	&"feast": {"name": "Feast", "max": 99, "desc": "Heal one heart.", "color": Color("ff5470")},
	&"hoard": {"name": "Pearl Hoard", "max": 99, "desc": "+5 pearls.", "color": Color("d8ecff")},
}


static func info(id: StringName) -> Dictionary:
	if LIST.has(id):
		return LIST[id]
	return FILLERS[id]
