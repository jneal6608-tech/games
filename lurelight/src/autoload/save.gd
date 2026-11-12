extends Node
## Persistent player data. One small JSON file, written atomically (temp file, then rename).

const PATH := "user://save.json"
const TMP := "user://save.tmp"
const VERSION := 1

var data := {
	"version": VERSION,
	"best_depth": 0,
	"best_kills": 0,
	"best_combo": 0,
	"pearls": 0,
	"runs": 0,
	"daily": {},
	"music": true,
	"sfx": true,
	"haptics": true,
	"clip_mode": false,
	"tutorial_done": false,
	"live_depth": 0,  # depth of a dive in progress; non-zero at launch means the last dive was cut off
	"live_pearls": 0,  # pearls collected so far in that dive, kept if it is cut off
	# progression (rules are in Meta)
	"upgrades": {},  # upgrade id -> level
	"fish": "angler",
	"fish_owned": [],  # the starting fish is always owned
	"glow": "",  # lure glow (cosmetic); empty = the fish's natural colour
	"glows_owned": [],
	"stats": {},  # lifetime counters for achievements
	"achievements": {},  # id -> true
	"reward_last": 0,  # day number of the last daily reward claim
	"reward_streak": 0,
	"daily_last": 0,  # day number of the last finished daily dive
	"daily_streak": 0,
	# purchases and ad pacing (see Ads and Store)
	"no_ads": false,
	"starter_pack": false,
	"granted_tokens": [],  # pearl-pack purchases already paid out (see Store)
	"ad_free_runs": 0,  # dives finished since the last interstitial
}


var _defaults := {}


func _ready() -> void:
	_defaults = data.duplicate(true)
	load_game()


func reset() -> void:
	## Back to a brand-new player (tests only; nothing in the game calls this).
	data = _defaults.duplicate(true)
	save_game()


func load_game() -> void:
	if not FileAccess.file_exists(PATH):
		return
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		return
	var json := JSON.new()
	var err := json.parse(f.get_as_text())
	f.close()
	if err != OK or typeof(json.data) != TYPE_DICTIONARY:
		return  # unreadable save: keep defaults rather than crash
	var d: Dictionary = json.data
	for k: String in data.keys():
		if d.has(k) and typeof(d[k]) == typeof(data[k]):
			data[k] = d[k]
		elif d.has(k) and typeof(data[k]) == TYPE_INT and typeof(d[k]) == TYPE_FLOAT:
			data[k] = int(d[k])  # JSON has no integers


func save_game() -> void:
	var f := FileAccess.open(TMP, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(data))
	f.close()
	DirAccess.rename_absolute(TMP, PATH)


func today() -> String:
	return Time.get_date_string_from_system()


func day_index() -> int:
	## Days since 1970 in local time: consecutive calendar days differ by exactly one.
	return int(Time.get_unix_time_from_datetime_string(today()) / 86400)


func daily_best() -> int:
	var d: Dictionary = data["daily"]
	return int(d.get(today(), 0))


func record_run(depth: int, kills: int, combo: int, pearls: int, daily: bool) -> bool:
	## Returns true when this run set a new best depth.
	var new_best := depth > int(data["best_depth"])
	if new_best:
		data["best_depth"] = depth
	data["best_kills"] = maxi(int(data["best_kills"]), kills)
	data["best_combo"] = maxi(int(data["best_combo"]), combo)
	data["pearls"] = int(data["pearls"]) + pearls
	data["runs"] = int(data["runs"]) + 1
	if daily:
		var day := today()
		var d: Dictionary = data["daily"]
		d[day] = maxi(int(d.get(day, 0)), depth)
		# keep the file small: only the last two weeks of daily results
		var keys := d.keys()
		keys.sort()
		while keys.size() > 14:
			d.erase(keys.pop_front())
	save_game()
	return new_best


func mark_live(depth: int, pearls := 0) -> void:
	data["live_depth"] = maxi(depth, 1)
	data["live_pearls"] = maxi(pearls, 0)
	save_game()


func clear_live() -> void:
	if int(data["live_depth"]) != 0 or int(data["live_pearls"]) != 0:
		data["live_depth"] = 0
		data["live_pearls"] = 0
		save_game()


func bank_dive(depth: int, pearls: int) -> void:
	## Keeps what an unfinished dive earned (quit from the pause menu, or cut off when the app was killed):
	## its pearls, and its depth toward the best dive. Depth and daily bonuses still need a finished dive.
	data["pearls"] = int(data["pearls"]) + maxi(pearls, 0)
	data["best_depth"] = maxi(int(data["best_depth"]), depth)
	data["live_depth"] = 0
	data["live_pearls"] = 0
	save_game()


func take_cut_off() -> int:
	## Depth of a dive that ended without finishing (the app or browser tab was killed), or 0.
	## The depth still counts toward the best dive, since the player earned it.
	var d := int(data["live_depth"])
	if d <= 0:
		return 0
	bank_dive(d, int(data["live_pearls"]))
	return d
