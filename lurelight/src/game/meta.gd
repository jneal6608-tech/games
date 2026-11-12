class_name Meta
## Everything that lasts between dives: pearl-shop upgrades, unlockable fish, achievements and daily rewards.
## Definitions and rules live here; the numbers themselves are stored by Save.

# ------------------------------------------------------------------ pearl shop
## Permanent upgrades. Deliberately modest: a fully upgraded fish is roughly a fifth stronger, so skill still decides.
const UPGRADES := {
	&"weight": {"name": "Dense Lure", "desc": "+4% lure damage per level.", "costs": [40, 80, 140, 220, 320], "color": Color("ffd86b")},
	&"bait": {"name": "Bright Bait", "desc": "+8% pickup range per level.", "costs": [30, 60, 100, 160, 240], "color": Color("7cffcb")},
	&"luck": {"name": "Pearl Diver", "desc": "+10% chance a pearl counts double.", "costs": [50, 100, 170, 260, 380], "color": Color("d8ecff")},
	&"reroll": {"name": "Second Thoughts", "desc": "+1 mutation reroll every dive.", "costs": [120, 360], "color": Color("a8b8ff")},
	&"hide": {"name": "Thick Hide", "desc": "+1 heart at the start of every dive.", "costs": [200, 700], "color": Color("ff5470")},
	&"primed": {"name": "Head Start", "desc": "Begin every dive with a mutation.", "costs": [450], "color": Color("6be8ff")},
}

# ------------------------------------------------------------------ fish
## response scales how quickly the lure follows the thumb (and how quickly it stops): the top whirl speed is the same
## for every fish, so the difference is feel, not power. keep = extra momentum kept through a hit (0..1).
const FISH := {
	&"angler": {"name": "Lantern", "tag": "Balanced. The classic.", "cost": 0, "art": "", "tint": Color("ffe27a"), "size": 1.0,
		"hearts": 4, "speed": 1.0, "dmg": 1.0, "len": 1.0, "radius": 1.0, "response": 1.0, "keep": 0.0, "twin": 0},
	&"brute": {"name": "Anchorjaw", "tag": "Huge, heavy lure. Slow to wind up, then it ploughs through everything.", "cost": 300,
		"art": "_brute", "tint": Color("ff9a4a"), "size": 1.16,
		"hearts": 5, "speed": 0.92, "dmg": 1.3, "len": 1.0, "radius": 1.38, "response": 0.42, "keep": 0.6, "twin": 0},
	&"whip": {"name": "Glasswhip", "tag": "Long, light lure that snaps to your thumb. Fragile.", "cost": 300,
		"art": "_whip", "tint": Color("b8fbff"), "size": 0.88,
		"hearts": 3, "speed": 1.08, "dmg": 0.78, "len": 1.28, "radius": 0.8, "response": 1.8, "keep": 0.0, "twin": 0},
	&"twin": {"name": "Gemini", "tag": "Two lures from the first second. Each one hits softer.", "cost": 500,
		"art": "_twin", "tint": Color("ffb0f0"), "size": 1.0,
		"hearts": 4, "speed": 1.0, "dmg": 0.62, "len": 1.0, "radius": 0.92, "response": 1.0, "keep": 0.0, "twin": 1},
}

# ------------------------------------------------------------------ lure glows (cosmetic only)
## cost -1 = not sold for pearls (Aurora comes with the starter pack).
const GLOWS := {
	&"": {"name": "Natural", "color": Color("ffe27a"), "cost": 0},
	&"ember": {"name": "Ember", "color": Color("ff6a3a"), "cost": 120},
	&"venom": {"name": "Venom", "color": Color("9dff5c"), "cost": 120},
	&"frost": {"name": "Frost", "color": Color("8fd0ff"), "cost": 120},
	&"aurora": {"name": "Aurora", "color": Color("d0a0ff"), "cost": -1, "rainbow": true},
}

# ------------------------------------------------------------------ daily reward
const DAILY_REWARDS: Array[int] = [15, 20, 25, 30, 40, 50, 100]

# ------------------------------------------------------------------ achievements
## Each one watches a single number (see stat()). Unlocking pays pearls straight away.
const ACHIEVEMENTS := [
	{"id": "first_dive", "name": "Wet Fins", "desc": "Finish a dive.", "stat": "runs", "need": 1, "reward": 10},
	{"id": "runs_25", "name": "Regular", "desc": "Finish 25 dives.", "stat": "runs", "need": 25, "reward": 40},
	{"id": "runs_100", "name": "Old Salt", "desc": "Finish 100 dives.", "stat": "runs", "need": 100, "reward": 120},
	{"id": "depth_1000", "name": "Lights Out", "desc": "Reach the Midnight Zone (1,000 m).", "stat": "best_depth", "need": 1000, "reward": 25},
	{"id": "depth_2500", "name": "Abyss Gazer", "desc": "Reach the Abyss (2,500 m).", "stat": "best_depth", "need": 2500, "reward": 60},
	{"id": "depth_4500", "name": "Trench Runner", "desc": "Reach the Trench (4,500 m).", "stat": "best_depth", "need": 4500, "reward": 120},
	{"id": "depth_7500", "name": "Nobody Comes Here", "desc": "Dive to 7,500 m.", "stat": "best_depth", "need": 7500, "reward": 250},
	{"id": "boss_1", "name": "Pruned", "desc": "Defeat a boss.", "stat": "bosses", "need": 1, "reward": 20},
	{"id": "boss_10", "name": "Apex", "desc": "Defeat 10 bosses.", "stat": "bosses", "need": 10, "reward": 80},
	{"id": "boss_50", "name": "The Deep Fears You", "desc": "Defeat 50 bosses.", "stat": "bosses", "need": 50, "reward": 250},
	{"id": "flawless", "name": "Untouched", "desc": "Defeat a boss without losing a heart to it.", "stat": "flawless", "need": 1, "reward": 75},
	{"id": "kills_1000", "name": "Snack", "desc": "Eat 1,000 creatures.", "stat": "kills", "need": 1000, "reward": 30},
	{"id": "kills_10000", "name": "Feast", "desc": "Eat 10,000 creatures.", "stat": "kills", "need": 10000, "reward": 100},
	{"id": "kills_50000", "name": "Bottomless", "desc": "Eat 50,000 creatures.", "stat": "kills", "need": 50000, "reward": 250},
	{"id": "combo_50", "name": "Blender", "desc": "Reach a 50 combo.", "stat": "best_combo", "need": 50, "reward": 30},
	{"id": "combo_150", "name": "Whirlpool", "desc": "Reach a 150 combo.", "stat": "best_combo", "need": 150, "reward": 80},
	{"id": "combo_300", "name": "Maelstrom", "desc": "Reach a 300 combo.", "stat": "best_combo", "need": 300, "reward": 160},
	{"id": "level_15", "name": "Overgrown", "desc": "Reach level 15 in one dive.", "stat": "best_level", "need": 15, "reward": 40},
	{"id": "muts_8", "name": "Chimera", "desc": "Carry 8 different mutations in one dive.", "stat": "best_muts", "need": 8, "reward": 50},
	{"id": "daily_1", "name": "Today's Catch", "desc": "Finish a daily dive.", "stat": "dailies", "need": 1, "reward": 15},
	{"id": "daily_streak_3", "name": "Creature of Habit", "desc": "Daily dive 3 days in a row.", "stat": "best_daily_streak", "need": 3, "reward": 40},
	{"id": "daily_streak_7", "name": "Tidal", "desc": "Daily dive 7 days in a row.", "stat": "best_daily_streak", "need": 7, "reward": 120},
	{"id": "fish_2", "name": "New Blood", "desc": "Unlock another fish.", "stat": "fish_owned", "need": 2, "reward": 25},
	{"id": "fish_all", "name": "The Whole Shoal", "desc": "Unlock every fish.", "stat": "fish_owned", "need": 4, "reward": 120},
	{"id": "pearls_1000", "name": "Hoarder", "desc": "Collect 1,000 pearls in total.", "stat": "pearls_earned", "need": 1000, "reward": 60},
]


# ------------------------------------------------------------------ upgrades
static func upgrade_level(id: StringName) -> int:
	var u: Dictionary = Save.data["upgrades"]
	return mini(int(u.get(String(id), 0)), (UPGRADES[id]["costs"] as Array).size())


static func upgrade_cost(id: StringName) -> int:
	## Price of the next level, or -1 when maxed.
	var costs: Array = UPGRADES[id]["costs"]
	var lv := upgrade_level(id)
	return int(costs[lv]) if lv < costs.size() else -1


static func buy_upgrade(id: StringName) -> bool:
	var cost := upgrade_cost(id)
	if cost < 0 or int(Save.data["pearls"]) < cost:
		return false
	Save.data["pearls"] = int(Save.data["pearls"]) - cost
	var u: Dictionary = Save.data["upgrades"]
	u[String(id)] = upgrade_level(id) + 1
	Save.save_game()
	return true


static func can_buy_something() -> bool:
	var p := int(Save.data["pearls"])
	for id: StringName in UPGRADES:
		var c := upgrade_cost(id)
		if c >= 0 and p >= c:
			return true
	return false


static func can_unlock_fish() -> bool:
	for id: StringName in FISH:
		if not owns_fish(id) and int(Save.data["pearls"]) >= int(FISH[id]["cost"]):
			return true
	return false


static func daily_streak_alive() -> int:
	## The current daily-dive streak, or 0 once a day has been missed.
	return int(Save.data["daily_streak"]) if Save.day_index() - int(Save.data["daily_last"]) <= 1 else 0


# ------------------------------------------------------------------ fish
static func fish_id() -> StringName:
	var id := StringName(String(Save.data["fish"]))
	return id if FISH.has(id) and owns_fish(id) else &"angler"


static func fish_def(id: StringName = &"") -> Dictionary:
	return FISH[id if id != &"" else fish_id()]


static func owns_fish(id: StringName) -> bool:
	return id == &"angler" or (Save.data["fish_owned"] as Array).has(String(id))


static func buy_fish(id: StringName) -> bool:
	var cost := int(FISH[id]["cost"])
	if owns_fish(id) or int(Save.data["pearls"]) < cost:
		return false
	Save.data["pearls"] = int(Save.data["pearls"]) - cost
	(Save.data["fish_owned"] as Array).append(String(id))
	Save.data["fish"] = String(id)
	Save.save_game()
	return true


static func select_fish(id: StringName) -> void:
	if owns_fish(id):
		Save.data["fish"] = String(id)
		Save.save_game()


# ------------------------------------------------------------------ glows
static func owns_glow(id: StringName) -> bool:
	if id == &"":
		return true
	if id == &"aurora":
		return bool(Save.data["starter_pack"])
	return (Save.data["glows_owned"] as Array).has(String(id))


static func glow_id() -> StringName:
	var id := StringName(String(Save.data["glow"]))
	return id if GLOWS.has(id) and owns_glow(id) else &""


static func buy_glow(id: StringName) -> bool:
	var cost := int(GLOWS[id]["cost"])
	if owns_glow(id) or cost < 0 or int(Save.data["pearls"]) < cost:
		return false
	Save.data["pearls"] = int(Save.data["pearls"]) - cost
	(Save.data["glows_owned"] as Array).append(String(id))
	Save.data["glow"] = String(id)
	Save.save_game()
	return true


static func select_glow(id: StringName) -> void:
	if owns_glow(id):
		Save.data["glow"] = String(id)
		Save.save_game()


# ------------------------------------------------------------------ achievements
static func stat(key: String) -> int:
	match key:
		"best_depth", "best_combo", "runs":
			return int(Save.data[key])
		"fish_owned":
			var n := 1
			for id: StringName in FISH:
				if id != &"angler" and owns_fish(id):
					n += 1
			return n
	return int((Save.data["stats"] as Dictionary).get(key, 0))


static func bump(key: String, by: int) -> void:
	var s: Dictionary = Save.data["stats"]
	s[key] = int(s.get(key, 0)) + by


static func raise(key: String, to: int) -> void:
	var s: Dictionary = Save.data["stats"]
	s[key] = maxi(int(s.get(key, 0)), to)


static func add_pearls(n: int) -> void:
	Save.data["pearls"] = int(Save.data["pearls"]) + n
	bump("pearls_earned", n)


static func has_achievement(id: String) -> bool:
	return (Save.data["achievements"] as Dictionary).has(id)


static func check_achievements() -> Array:
	## Unlocks everything newly earned, pays the rewards, saves, and returns the definitions for display.
	var out: Array = []
	var done: Dictionary = Save.data["achievements"]
	# a reward can itself complete "collect N pearls", so go round until nothing new turns up
	var again := true
	while again:
		again = false
		for a: Dictionary in ACHIEVEMENTS:
			if not done.has(a["id"]) and stat(a["stat"]) >= int(a["need"]):
				done[a["id"]] = true
				add_pearls(int(a["reward"]))
				out.append(a)
				again = true
	if not out.is_empty():
		Save.save_game()
	return out


# ------------------------------------------------------------------ end of a dive
static func depth_bonus(depth: int) -> int:
	return depth / 100


static func finish_run(stats: Dictionary, daily: bool) -> Dictionary:
	## Banks a finished dive. Returns what the end card needs to show.
	var depth := int(stats["depth"])
	var bonus := depth_bonus(depth)
	var daily_bonus := 0
	bump("kills", int(stats["kills"]))
	bump("bosses", int(stats.get("bosses", 0)))
	bump("flawless", int(stats.get("flawless", 0)))
	raise("best_level", int(stats["level"]))
	raise("best_muts", (stats["muts"] as Dictionary).size())
	if daily:
		bump("dailies", 1)
		var day := Save.day_index()
		var last := int(Save.data["daily_last"])
		if day != last:
			Save.data["daily_streak"] = (int(Save.data["daily_streak"]) + 1) if day == last + 1 else 1
			Save.data["daily_last"] = day
			raise("best_daily_streak", int(Save.data["daily_streak"]))
			daily_bonus = 10 + 5 * mini(int(Save.data["daily_streak"]), 7)
	var earned := int(stats["pearls"]) + bonus + daily_bonus
	bump("pearls_earned", earned)
	var new_best := Save.record_run(depth, int(stats["kills"]), int(stats["combo"]), earned, daily)
	return {"new_best": new_best, "depth_bonus": bonus, "daily_bonus": daily_bonus, "earned": earned,
		"daily_streak": int(Save.data["daily_streak"]), "unlocked": check_achievements()}


# ------------------------------------------------------------------ daily reward
static func reward_ready() -> bool:
	return int(Save.data["reward_last"]) != Save.day_index()


static func reward_day() -> int:
	## Which day of the 7-day cycle the next claim is (0-based). Missing a day starts over.
	var last := int(Save.data["reward_last"])
	var streak := int(Save.data["reward_streak"])
	if Save.day_index() > last + 1:
		streak = 0
	return streak % DAILY_REWARDS.size()


static func claim_reward(mult := 1) -> int:
	if not reward_ready():
		return 0
	var d := reward_day()
	var n := DAILY_REWARDS[d] * mult
	Save.data["reward_streak"] = d + 1
	Save.data["reward_last"] = Save.day_index()
	add_pearls(n)
	Save.save_game()
	return n
