class_name World extends Node2D
## One dive. Owns the fish, lures, creatures, pickups and all run state.
## Main feeds it a joystick vector and listens to its signals; nothing in here touches menus.

signal level_up(choices: Array)
signal run_over(stats: Dictionary)
signal banner(title: String, sub: String, color: Color)
signal boss_changed(b: Enemy)
signal flashed(color: Color, strength: float)
signal hearts_changed

class Orb:
	var pos: Vector2
	var vel: Vector2
	var value: int
	var kind: int  # 0 plankton (xp), 1 pearl, 2 heart
	var age := 0.0
	var phase := 0.0
	var pulled := false

class Shot:
	var pos: Vector2
	var vel: Vector2
	var r := 12.0
	var life := 4.5
	var color: Color

class Wave:
	var pos: Vector2
	var vel: Vector2
	var r := 78.0
	var life := 0.55
	var dmg := 20.0
	var hit: Array = []

const ZONES := [
	{"name": "TWILIGHT ZONE", "depth": 200, "len": 75.0, "top": Color("0d4468"), "bot": Color("051326"), "rays": 1.0, "boss": &"bloom"},
	{"name": "MIDNIGHT ZONE", "depth": 1000, "len": 85.0, "top": Color("101a52"), "bot": Color("04061a"), "rays": 0.25, "boss": &"gulper"},
	{"name": "THE ABYSS", "depth": 2500, "len": 95.0, "top": Color("2a1048"), "bot": Color("070312"), "rays": 0.0, "boss": &"warden"},
	{"name": "THE TRENCH", "depth": 4500, "len": 90.0, "top": Color("3a0c1c"), "bot": Color("0a0206"), "rays": 0.0, "boss": &"bloom"},
]
const TRENCH_STEP := 1500
const BOSS_CYCLE: Array[StringName] = [&"bloom", &"gulper", &"warden"]
const SPAWN_TABLE := [
	[[&"krill", 70.0, 0.0], [&"jelly", 26.0, 10.0], [&"darter", 16.0, 42.0]],
	[[&"krill", 46.0, 0.0], [&"jelly", 24.0, 0.0], [&"darter", 24.0, 0.0], [&"squid", 18.0, 6.0], [&"urchin", 9.0, 25.0]],
	[[&"krill", 36.0, 0.0], [&"jelly", 16.0, 0.0], [&"darter", 20.0, 0.0], [&"squid", 20.0, 0.0], [&"urchin", 15.0, 0.0], [&"eel", 24.0, 8.0]],
]
const BASE_DMG := 10.0
const LURE_LEN := 230.0
const LURE_R := 24.0
const LURE_LEN_MULT: Array[float] = [1.0, 0.66, 1.32]
const H := 1.0 / 120.0
const ARMOR_SPEED := 1450.0
const CRACK_SPEED := 1900.0
const PICKUP_R := 150.0
const COMBO_WINDOW := 1.9
const SQUID_VOLLEY_GAP := 0.6  # at most one squid shot every 0.6 s, however many squid there are
const SQUID_CAP := [3, 3, 4, 5]  # squid alive at once, per zone
# The deep climb. 0 to 4,500 m is the normal curve (above); it is where players separate by skill.
# Reaching the Trench (4,500 m) turns the difficulty up at once, and from there it climbs faster and faster.
# deep() counts zones past 4,500 m (1.0 = 6,000 m, 2.0 = 7,500 m ...).
# pressure() = DEEP_START + DEEP_LINEAR * deep + DEEP_CURVE * deep^2 once in the Trench, else 0:
# 2 at 4,500 m, 4 at 6,000 m, 7 at 7,500 m, 11 at 9,000 m, 16 at 10,500 m.
# Every knob below is "per point of pressure". The creature cap stays at 165 for phones.
const DEEP_START := 2.0  # the jump on reaching the Trench
const DEEP_LINEAR := 1.5
const DEEP_CURVE := 0.5  # how sharply the climb accelerates (0 = straight line)
const DEEP_SPEED := 0.05  # extra enemy speed ...
const DEEP_SPEED_MAX := 0.8  # ... up to +80% on top of the old x1.4 (x2.2 in all, around 10,500 m)
const DEEP_RATE := 0.4  # extra spawns per second (refills faster after a whirl clears the screen) ...
const DEEP_RATE_MAX := 6.0
const DEEP_MIX := 0.12  # dangerous creatures get this much more common, relative to krill ...
const DEEP_MIX_MAX := 2.0  # ... up to three times as common
const DEEP_HP := 0.12  # extra enemy health, no ceiling: past every other cap this keeps the climb going
const DEEP_ELITE := 0.15  # elites come this much more often, never more than every 6 s
const DEEP_SQUID_MAX := 5  # one more squid allowed per 2 pressure, up to 5 more

const CELL := 110.0
const COMBO_MARKS: Array[int] = [10, 25, 50, 100, 150, 200, 300, 500]

# configuration
var attract := false  # menu backdrop: fish and lure only
var bot := false  # automated player, for tests and trailers
var seed_value := 0  # non-zero = fixed seed (daily dive)
var fish_kind: StringName = &""  # empty = the player's selected fish
var use_meta := true  # apply pearl-shop upgrades (off for the bench and for baseline balance runs)

# live objects
var fish: Fish
var lures: Array[Lure] = []
var enemies: Array[Enemy] = []
var orbs: Array[Orb] = []
var shots: Array[Shot] = []
var waves: Array[Wave] = []
var clouds: Array = []  # [pos, life, radius]
var fx: Fx
var items: Items
var bg: Background
var cam: Camera2D
var boss: Enemy = null

# run state
var running := false
var paused := false
var input_vec := Vector2.ZERO
var t := 0.0
var real_t := 0.0
var zone := 0
var zone_t := 0.0
var depth := 200.0
var kills := 0
var combo := 0
var combo_t := 0.0
var best_combo := 0
var level := 1
var xp := 0.0
var xp_need := 6.0
var hearts := 4
var max_hearts := 4
var pearls_run := 0
var muts := {}
var moved_time := 0.0
var hurt_log := {}  # what damaged the player this run (for balancing)
var rerolls := 0  # mutation rerolls left this dive
var bosses_run := 0
var flawless_run := 0  # bosses beaten without losing a heart during the fight
var revived := false
var fdef := {}  # the fish being played (Meta.FISH entry)

# derived stats
var stat_dmg := 1.0
var stat_crit := 0.0
var stat_pickup := PICKUP_R
var stat_luck := 0.0  # chance a pearl counts double

var rng := RandomNumberGenerator.new()
var _acc := 0.0
var _spawn_acc := 0.0
var _swarm_t := 34.0
var _elite_t := 38.0
var _boss_pending := false
var _warn_t := 0.0
var _pulse_t := 3.0
var _tox_tick := 0.0
var _stop_t := 0.0
var _slow_t := 0.0
var _slow_scale := 1.0
var _shake := 0.0
var _dying_t := -1.0
var _lvl_delay := -1.0
var _xp_streak := 0
var _xp_streak_t := 0.0
var _grid := {}
var _bot_ang := 0.0
var _clink_text_t := 0.0
var _view := Vector2(1080, 1920)
var _heart_pity := 0
var _squid_next := 0.0
var squid_volleys := 0  # dev stat
var _last_heart_t := 0.0
var _boss_hearts := 0  # hearts lost when the boss appeared (for the flawless check)
var _hearts_lost := 0
var _free_pick := -1.0


func _ready() -> void:
	if seed_value != 0:
		rng.seed = seed_value
	else:
		rng.randomize()
	bg = Background.new()
	add_child(bg)
	fx = Fx.new()
	fx.world = self
	add_child(fx)
	items = Items.new()
	items.world = self
	add_child(items)
	fdef = Meta.fish_def(fish_kind)
	fish = Fish.new()
	fish.size = float(fdef["size"])
	fish.art = fdef["art"]
	add_child(fish)
	if int(fdef["twin"]) > 0:
		muts[&"twin"] = int(fdef["twin"])
	max_hearts = int(fdef["hearts"])
	if use_meta and not attract:
		max_hearts += Meta.upgrade_level(&"hide")
		rerolls = Meta.upgrade_level(&"reroll")
		stat_luck = 0.1 * Meta.upgrade_level(&"luck")
		if Meta.upgrade_level(&"primed") > 0:
			_free_pick = 1.1
	hearts = max_hearts
	cam = Camera2D.new()
	add_child(cam)
	cam.make_current()
	_recompute()
	xp_need = _need(level)
	_view = get_viewport_rect().size
	if not attract:
		running = true
		for i in 3:
			_spawn_cluster(&"krill", 4, _ring_pos(760.0 + i * 140.0))


# ------------------------------------------------------------------ frame
func _process(delta: float) -> void:
	var real := minf(delta, 0.05)
	if paused:
		return
	real_t += real
	_view = get_viewport_rect().size
	var ts := 1.0
	if _stop_t > 0.0:
		_stop_t -= real
		ts = 0.0
	elif _slow_t > 0.0:
		_slow_t -= real
		ts = _slow_scale
	var dt := real * ts
	if dt > 0.0:
		_sim(dt)
	# camera
	cam.position = cam.position.lerp(fish.position + fish.vel * 0.1, 1.0 - exp(-8.0 * real))
	_shake *= exp(-9.0 * real)
	cam.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * _shake if _shake > 0.3 else Vector2.ZERO
	fx.tick(real * maxf(ts, 0.25))
	items.tick(real)
	bg.tick(real, cam.position)
	if _dying_t >= 0.0:
		_dying_t -= real
		for l: Lure in lures:
			l.light = maxf(0.0, l.light - real * 0.9)
		if _dying_t < 0.0:
			_dying_t = -1.0
			run_over.emit(stats())
	if _lvl_delay >= 0.0:
		_lvl_delay -= real
		if _lvl_delay < 0.0:
			_lvl_delay = -1.0
			if running and xp >= xp_need:
				_level_up()
	if _free_pick >= 0.0 and running:
		_free_pick -= real
		if _free_pick < 0.0:
			_free_pick = -1.0
			_offer_pick()


func _sim(dt: float) -> void:
	if attract:
		input_vec = Vector2(cos(real_t * 1.3), sin(real_t * 2.6) * 0.75) * 0.8
	elif bot and running:
		_bot_input(dt)
	fish.input_dir = input_vec.limit_length(1.0) if (running or attract) else Vector2.ZERO
	var a0 := fish.stalk_anchor()
	fish.tick(dt)
	var a1 := fish.stalk_anchor()
	if input_vec.length() > 0.3:
		moved_time += dt
	# lure physics at a fixed 120 Hz
	_acc += dt
	var n := mini(int(_acc / H), 8)
	_acc -= n * H
	for l: Lure in lures:
		l.last_head = l.head()
	for k in n:
		var a := a0.lerp(a1, float(k + 1) / n)
		for l: Lure in lures:
			l.step(a, fish.vel, H)
	for l: Lure in lures:
		l.post_step(dt)
	if not running:
		return
	t += dt
	_spawn(dt)
	_tick_enemies(dt)
	_lure_hits()
	_abilities(dt)
	_tick_shots(dt)
	_tick_orbs(dt)
	_tick_zone(dt)
	_reap()
	if combo > 0:
		combo_t -= dt
		if combo_t <= 0.0:
			combo = 0
	_xp_streak_t -= dt
	if _xp_streak_t <= 0.0:
		_xp_streak = 0
	_clink_text_t -= dt


# ------------------------------------------------------------------ helpers
func on_screen(p: Vector2, margin := 60.0) -> bool:
	var d := p - cam.position
	return absf(d.x) < _view.x * 0.5 + margin and absf(d.y) < _view.y * 0.5 + margin


func shake(amount: float) -> void:
	_shake = minf(maxf(_shake, amount), 42.0)


func hitstop(sec: float) -> void:
	_stop_t = maxf(_stop_t, sec)


func slowmo(scale: float, sec: float) -> void:
	_slow_scale = scale
	_slow_t = sec


func _need(lv: int) -> float:
	return 10.0 + lv * 9.0 + lv * lv * 1.2


func _edge_pos(margin := 140.0) -> Vector2:
	var hw := _view.x * 0.5 + margin
	var hh := _view.y * 0.5 + margin
	var c := cam.position
	match rng.randi_range(0, 3):
		0:
			return c + Vector2(rng.randf_range(-hw, hw), -hh)
		1:
			return c + Vector2(rng.randf_range(-hw, hw), hh)
		2:
			return c + Vector2(-hw, rng.randf_range(-hh, hh))
		_:
			return c + Vector2(hw, rng.randf_range(-hh, hh))


func _ring_pos(radius: float) -> Vector2:
	return fish.position + Vector2.from_angle(rng.randf() * TAU) * radius


static func _seg_dist_sq(a: Vector2, b: Vector2, p: Vector2) -> float:
	var ab := b - a
	var l2 := ab.length_squared()
	if l2 < 0.0001:
		return p.distance_squared_to(a)
	var k := clampf((p - a).dot(ab) / l2, 0.0, 1.0)
	return p.distance_squared_to(a + ab * k)


func zone_def(z: int) -> Dictionary:
	return ZONES[mini(z, ZONES.size() - 1)]


func zone_start_depth(z: int) -> float:
	if z < ZONES.size():
		return float(ZONES[z]["depth"])
	return float(ZONES[-1]["depth"]) + float(TRENCH_STEP) * (z - ZONES.size() + 1)


func stats() -> Dictionary:
	return {"depth": int(depth), "kills": kills, "combo": best_combo, "time": t, "level": level, "muts": muts.duplicate(),
		"pearls": pearls_run, "zone": zone_def(zone)["name"], "hurt": hurt_log, "bosses": bosses_run, "flawless": flawless_run,
		"fish": fish_kind if fish_kind != &"" else Meta.fish_id()}


# ------------------------------------------------------------------ spawning
func _hp_mult() -> float:
	return 1.0 + t / 200.0 + zone * 0.4 + DEEP_HP * pressure()


func _speed_mult() -> float:
	return 1.0 + minf(0.4, t / 1100.0) + minf(DEEP_SPEED_MAX, DEEP_SPEED * pressure())


func deep() -> float:
	## How far past the start of the Trench the dive is, in zones (0 above 4,500 m).
	return maxf(0.0, (depth - float(ZONES[-1]["depth"])) / float(TRENCH_STEP))


func pressure() -> float:
	## The deep-climb difficulty: 0 above the Trench, then a jump, then growing faster the deeper the dive goes.
	if depth < float(ZONES[-1]["depth"]):
		return 0.0
	var d := deep()
	return DEEP_START + DEEP_LINEAR * d + DEEP_CURVE * d * d


func spawn(kind: StringName, pos: Vector2, elite := false) -> Enemy:
	var e := Enemy.new()
	e.setup(kind, _hp_mult(), _speed_mult(), elite)
	e.position = pos
	add_child(e)
	enemies.append(e)
	return e


func _spawn_cluster(kind: StringName, count: int, center: Vector2) -> void:
	for i in count:
		spawn(kind, center + Vector2(rng.randf_range(-70, 70), rng.randf_range(-70, 70)))


func spawn_ring(kind: StringName, count: int, radius: float, arc := TAU) -> void:
	## arc < TAU leaves a gap to escape through
	var off := rng.randf() * TAU
	for i in count:
		spawn(kind, fish.position + Vector2.from_angle(off + arc * i / count) * radius)


func _spawn(dt: float) -> void:
	if _boss_pending:
		return
	var cap := minf(44.0 + t * 0.5, 165.0)
	var rate := minf(0.75 + t / 40.0, 7.5) + minf(DEEP_RATE_MAX, DEEP_RATE * pressure())
	if boss != null:
		rate = 0.7
		cap = 26.0
	_spawn_acc += rate * dt
	while _spawn_acc >= 1.0:
		_spawn_acc -= 1.0
		if enemies.size() >= int(cap):
			_spawn_acc = 0.0
			break
		_spawn_one()
	if boss != null:
		return
	_swarm_t -= dt
	if _swarm_t <= 0.0:
		_swarm_t = rng.randf_range(21.0, 29.0)
		spawn_ring(&"krill", (10 if t < 60.0 else 14) + mini(zone, 4) * 4, maxf(_view.y * 0.5 + 80.0, 900.0) if zone > 0 else 820.0,
			TAU * 0.62 if zone == 0 else TAU)
		items.text(fish.position + Vector2(0, -150), "SWARM!", UI.CYAN, 56, 1.2)
	_elite_t -= dt
	if _elite_t <= 0.0:
		_elite_t = maxf(6.0, rng.randf_range(32.0, 42.0) / (1.0 + DEEP_ELITE * pressure()))
		var pool: Array[StringName] = [&"jelly"]
		if zone >= 1:
			pool.append(&"squid")
			pool.append(&"urchin")
		if zone >= 2:
			pool.append(&"eel")
		spawn(pool[rng.randi_range(0, pool.size() - 1)], _edge_pos(), true)
		# far down, elites arrive in pairs, then threes
		for extra in (1 if pressure() >= 4.0 else 0) + (1 if pressure() >= 10.0 else 0):
			spawn(pool[rng.randi_range(0, pool.size() - 1)], _edge_pos(), true)


func _spawn_one() -> void:
	var table: Array = SPAWN_TABLE[mini(zone, SPAWN_TABLE.size() - 1)]
	var harder := 1.0 + minf(DEEP_MIX_MAX, DEEP_MIX * pressure())
	var total := 0.0
	for row: Array in table:
		if zone_t >= float(row[2]):
			total += float(row[1]) * (1.0 if row[0] == &"krill" else harder)
	var pick := rng.randf() * total
	var kind: StringName = &"krill"
	for row: Array in table:
		if zone_t < float(row[2]):
			continue
		pick -= float(row[1]) * (1.0 if row[0] == &"krill" else harder)
		if pick <= 0.0:
			kind = row[0]
			break
	if kind == &"squid":
		var n := 0
		for e: Enemy in enemies:
			if e.kind == &"squid" and not e.dying:
				n += 1
		if n >= int(SQUID_CAP[mini(zone, SQUID_CAP.size() - 1)]) + mini(DEEP_SQUID_MAX, int(pressure() / 2.0)):
			kind = &"krill"
	if kind == &"krill":
		_spawn_cluster(kind, rng.randi_range(3, 5), _edge_pos(180.0))
	else:
		spawn(kind, _edge_pos())


func _spawn_boss() -> void:
	var kind: StringName = zone_def(zone)["boss"] if zone < ZONES.size() - 1 else BOSS_CYCLE[(zone - (ZONES.size() - 1)) % 3]
	var e := Enemy.new()
	e.setup(kind, 1.0 + zone * 0.55 + maxf(0.0, t - 300.0) / 200.0, 1.0)
	e.position = cam.position + Vector2(rng.randf_range(-200, 200), -_view.y * 0.5 - 260.0)
	e.timer = 2.0
	add_child(e)
	enemies.append(e)
	boss = e
	_boss_hearts = _hearts_lost
	boss_changed.emit(e)


# ------------------------------------------------------------------ enemies
func _tick_enemies(dt: float) -> void:
	_grid.clear()
	var fp := fish.position
	var can_hurt := fish.invuln <= 0.0
	for e: Enemy in enemies:
		if e.dying:
			continue
		e.tick(dt, self)
		var d := e.position - fp
		var d2 := d.length_squared()
		if can_hurt:
			var rr := e.radius * 0.8 + Fish.RADIUS * 0.7
			if d2 < rr * rr:
				_hurt(e.position, e.kind)
				can_hurt = false
		if d2 > 2500.0 * 2500.0 and not e.boss:
			e.position = _edge_pos()
		var key := Vector2i(floori(e.position.x / CELL), floori(e.position.y / CELL))
		if _grid.has(key):
			_grid[key].append(e)
		else:
			_grid[key] = [e]
	# soft separation within a cell: cheap, and enough to stop creatures stacking
	for cell: Array in _grid.values():
		var n := cell.size()
		if n < 2:
			continue
		for i in n:
			var a: Enemy = cell[i]
			for j in range(i + 1, n):
				var b: Enemy = cell[j]
				var d := b.position - a.position
				var rr := (a.radius + b.radius) * 0.9
				var l2 := d.length_squared()
				if l2 < rr * rr and l2 > 0.01:
					var l := sqrt(l2)
					var push := d / l * (rr - l) * minf(1.0, dt * 9.0)
					var wa := b.mass / (a.mass + b.mass)
					a.position -= push * wa
					b.position += push * (1.0 - wa)


func _reap() -> void:
	var i := enemies.size() - 1
	while i >= 0:
		var e := enemies[i]
		if e.dying:
			enemies.remove_at(i)
			e.queue_free()
		i -= 1


func _lure_hits() -> void:
	for li in lures.size():
		var l := lures[li]
		var p := l.head()
		var q := l.last_head
		# bat enemy shots out of the water
		var si := shots.size() - 1
		while si >= 0:
			var s := shots[si]
			var rr := l.radius + s.r + 8.0
			if _seg_dist_sq(q, p, s.pos) < rr * rr:
				fx.burst(s.pos, Color(1.0, 0.6, 0.7), 5, 260.0, 0.8, 0.3)
				Sfx.play("clink", -14.0, randf_range(1.3, 1.6), 0.05)
				shots.remove_at(si)
			si -= 1
		var f := clampf((l.speed - 250.0) / 1150.0, 0.0, 2.2)
		if f < 0.08:
			continue
		for e: Enemy in enemies:
			if e.dying or e.hit_cd[li] > 0.0:
				continue
			var rr := l.radius + e.radius
			if _seg_dist_sq(q, p, e.position) < rr * rr:
				_hit(e, l, li, f)
			elif not e.boss and not e.armored:
				_stalk_slap(e, l, li)


func _stalk_slap(e: Enemy, l: Lure, li: int) -> void:
	## The stalk itself bats small creatures away, so a whirl protects the space inside it too.
	## It moves slower near the fish, so it hits much softer than the lure.
	var a := l.anchor()
	var ab := l.head() - a
	var l2 := ab.length_squared()
	if l2 < 1.0:
		return
	var k := clampf((e.position - a).dot(ab) / l2, 0.0, 1.0)
	var rr := e.radius + 8.0
	if e.position.distance_squared_to(a + ab * k) > rr * rr:
		return
	var f := clampf((l.speed * k - 250.0) / 1150.0, 0.0, 2.2)
	if f < 0.05:
		return
	e.hit_cd[li] = 0.25
	# knocked along the swing and outward, back toward the lure's path
	var out := (e.position - a).normalized()
	e.knock += (l.head_vel.normalized() + out).normalized() * (260.0 + 420.0 * f) / e.mass
	Sfx.play("hit", -12.0, 1.3 + randf_range(-0.05, 0.05), 0.05)
	fx.burst(e.position, e.color.lerp(Color.WHITE, 0.5), 3, 200.0, 0.7, 0.25)
	_damage(e, BASE_DMG * stat_dmg * f * 0.5, true)


func _hit(e: Enemy, l: Lure, li: int, f: float) -> void:
	var dir := l.head_vel.normalized()
	var contact := e.position + (l.head() - e.position).limit_length(e.radius)
	e.hit_cd[li] = 0.25
	if e.armored and l.speed < ARMOR_SPEED:
		l.bounce((l.head() - e.position).normalized(), 0.55)
		Sfx.play("clink", -5.0, randf_range(0.9, 1.1))
		fx.burst(contact, Color(1, 0.95, 0.8), 4, 220.0, 0.7, 0.25)
		e.hurt_flash(0.3)
		if _clink_text_t <= 0.0:
			_clink_text_t = 1.6
			items.text(e.position + Vector2(0, -e.radius - 20), "SWING FASTER!", UI.GOLD, 34, 0.9)
		_damage(e, BASE_DMG * stat_dmg * f * 0.12, true)
		return
	var crit := randf() < stat_crit
	var dmg := BASE_DMG * stat_dmg * f * (2.5 if crit else 1.0)
	var heavy := f > 1.3 or crit
	l.slow(0.7 if e.boss else lerpf(0.94, 0.8, clampf(e.mass / 3.0, 0.0, 1.0)))
	e.knock += dir * (240.0 + 420.0 * f) / e.mass
	Sfx.play("hit_heavy" if heavy else "hit", -3.0 if heavy else -6.0, 0.85 + f * 0.16 + randf_range(-0.05, 0.05))
	fx.burst(contact, e.color.lerp(Color.WHITE, 0.55), 4 + int(f * 4.0), 280.0 + 240.0 * f, 0.9, 0.35, dir, 70.0)
	shake((2.0 + 4.0 * f) * (1.6 if crit else 1.0))
	if heavy:
		hitstop(0.03)
		Sfx.buzz(14)
	if crit:
		items.text(contact + Vector2(0, -30), "CRIT", Color("fff6e0"), 36, 0.6)
	e.interrupt()
	_damage(e, dmg, true)


func claim_squid_volley() -> bool:
	if t < _squid_next:
		return false
	_squid_next = t + SQUID_VOLLEY_GAP
	squid_volleys += 1
	return true


func _damage(e: Enemy, dmg: float, by_lure := false) -> void:
	if e.dying:
		return
	e.hp -= dmg
	e.hurt_flash(1.0)
	if e.hp <= 0.0:
		_kill(e, by_lure)


func _kill(e: Enemy, by_lure: bool) -> void:
	e.dying = true
	kills += 1
	if e.boss:
		_boss_killed(e)
		return
	combo += 1
	combo_t = COMBO_WINDOW
	best_combo = maxi(best_combo, combo)
	if combo in COMBO_MARKS:
		items.text(fish.position + Vector2(0, -170), "%d COMBO!" % combo, UI.GOLD, 64, 1.2)
		Sfx.play("combo", -2.0, 1.0 + COMBO_MARKS.find(combo) * 0.08)
		flashed.emit(UI.GOLD, 0.05)
		_drop(e.position, 1, 1)
	Sfx.play("pop", -5.0, 1.0 + minf(combo, 40.0) * 0.02 + randf_range(-0.04, 0.04), 0.03)
	fx.burst(e.position, e.color, 22 if e.elite else 9, 420.0 if e.elite else 340.0, 1.4 if e.elite else 1.0)
	fx.ring(e.position, e.radius * (2.4 if e.elite else 1.7), e.color, 0.28)
	_drop(e.position, e.xp, 0)
	# a wounded player who keeps fighting earns a heart now and then (never more than one per 40 s)
	if hearts < max_hearts:
		_heart_pity += 1
		if _heart_pity >= 120 and t - _last_heart_t > 40.0:
			_heart_pity = 0
			_last_heart_t = t
			_drop(e.position, 1, 2)
	if e.elite:
		shake(12.0)
		hitstop(0.05)
		_drop(e.position, 1, 1)
		_drop(e.position, 1, 1)
		if hearts < max_hearts and rng.randf() < 0.5:
			_drop(e.position, 1, 2)
	elif rng.randf() < 0.03:
		_drop(e.position, 1, 1)
	var chain_lv: int = muts.get(&"chain", 0)
	if by_lure and chain_lv > 0:
		_chain(e.position, chain_lv)


func _chain(from: Vector2, lv: int) -> void:
	var left := 1 + lv
	var dmg := 7.0 + 5.0 * lv
	var zapped := false
	for e: Enemy in enemies:
		if left <= 0:
			break
		if e.dying or e.position.distance_squared_to(from) > 330.0 * 330.0:
			continue
		fx.bolt(from, e.position, Color("a8b8ff"))
		_damage(e, dmg * stat_dmg)
		left -= 1
		zapped = true
	if zapped:
		Sfx.play("zap", -9.0, randf_range(0.9, 1.2), 0.06)


func _drop(pos: Vector2, value: int, kind: int) -> void:
	if kind == 0 and orbs.size() > 220:
		# too many on screen: fold the value into an existing orb instead
		var o: Orb = orbs[randi() % orbs.size()]
		if o.kind == 0:
			o.value += value
			return
	var o := Orb.new()
	o.pos = pos
	o.vel = Vector2.from_angle(randf() * TAU) * randf_range(60.0, 200.0)
	o.value = value
	o.kind = kind
	o.phase = randf() * TAU
	orbs.append(o)


# ------------------------------------------------------------------ player damage / death
func _hurt(from: Vector2, cause: StringName = &"?") -> void:
	if fish.dead or fish.invuln > 0.0:
		return
	hurt_log[cause] = int(hurt_log.get(cause, 0)) + 1
	if bot and OS.is_debug_build() and OS.get_cmdline_user_args().has("--hurtlog"):
		print("HURT t=%.1f by=%s lure=%d omega=%.1f fish=%d input=%s enemies=%d muts=%s" % [t, cause, int(lures[0].speed), lures[0].omega, int(fish.vel.length()), str(input_vec), enemies.size(), str(muts)])
	hearts -= 1
	_hearts_lost += 1
	hearts_changed.emit()
	fish.invuln = 1.3
	fish.bump()
	combo = 0
	shake(22.0)
	hitstop(0.09)
	flashed.emit(UI.RED, 0.35)
	Sfx.play("hurt")
	Sfx.buzz(70)
	fx.ring(fish.position, 300.0, UI.RED, 0.45, 12.0)
	fx.burst(fish.position, Color(1, 0.4, 0.5), 16, 420.0, 1.2)
	fish.vel = (fish.position - from).normalized() * 520.0
	_shove(fish.position, 340.0, 760.0)
	# the burst also damages, so one hit cannot snowball into four
	for e: Enemy in enemies:
		if not e.dying and not e.boss and e.position.distance_squared_to(fish.position) < 300.0 * 300.0:
			_damage(e, 14.0 * stat_dmg)
	if hearts <= 0:
		_die()


func _shove(center: Vector2, radius: float, force: float) -> void:
	for e: Enemy in enemies:
		var d := e.position - center
		var l := d.length()
		if l < radius + e.radius and l > 0.01:
			e.knock += d / l * force / maxf(1.0, e.mass * 0.6)
	var si := shots.size() - 1
	while si >= 0:
		if shots[si].pos.distance_to(center) < radius:
			shots.remove_at(si)
		si -= 1


func _die() -> void:
	running = false
	fish.dead = true
	_dying_t = 1.7
	slowmo(0.35, 1.2)
	Sfx.play("gameover", -2.0)
	Sfx.music("", 1.0)
	Sfx.buzz(220)
	if boss != null:
		boss_changed.emit(null)


# ------------------------------------------------------------------ pickups, xp, level-ups
func _tick_orbs(dt: float) -> void:
	var fp := fish.position
	var pr2 := stat_pickup * stat_pickup
	var i := orbs.size() - 1
	while i >= 0:
		var o := orbs[i]
		o.age += dt
		var d := fp - o.pos
		var d2 := d.length_squared()
		if not o.pulled and o.age > 0.22 and d2 < pr2:
			o.pulled = true
		if o.pulled:
			o.vel = o.vel.lerp(d.normalized() * (700.0 + o.age * 500.0), minf(1.0, dt * 9.0))
		else:
			o.vel *= exp(-3.5 * dt)
		o.pos += o.vel * dt
		if d2 < 40.0 * 40.0:
			_collect(o)
			orbs.remove_at(i)
		elif o.age > 45.0 and not o.pulled:
			orbs.remove_at(i)
		i -= 1


func _collect(o: Orb) -> void:
	match o.kind:
		0:
			_xp_streak = mini(_xp_streak + 1, 24) if _xp_streak_t > 0.0 else 0
			_xp_streak_t = 0.5
			Sfx.play("xp", -9.0, 0.9 + _xp_streak * 0.035, 0.03)
			xp += o.value
			if xp >= xp_need and _lvl_delay < 0.0:
				_level_up()
		1:
			var got := o.value * (2 if randf() < stat_luck else 1)
			pearls_run += got
			Sfx.play("pearl", -5.0, 1.0 if got == o.value else 1.25)
			items.text(fish.position + Vector2(0, -80), "+%d" % got, Color("d8ecff") if got == o.value else UI.GOLD, 36, 0.7)
		2:
			if hearts < max_hearts:
				hearts += 1
				hearts_changed.emit()
			Sfx.play("heart", -3.0)
			fx.ring(fish.position, 140.0, UI.RED, 0.4)


func _level_up() -> void:
	xp -= xp_need
	level += 1
	xp_need = _need(level)
	Sfx.play("levelup")
	fx.ring(fish.position, 520.0, UI.GOLD, 0.6, 14.0)
	_shove(fish.position, 420.0, 900.0)
	flashed.emit(UI.GOLD, 0.07)
	_offer_pick()


func _offer_pick() -> void:
	if bot:
		var c := _offers()
		choose(c[rng.randi_range(0, c.size() - 1)])
		return
	paused = true
	level_up.emit(_offers())


func reroll() -> Array:
	## A fresh set of offers for the level-up that is on screen.
	return _offers()


func revive() -> void:
	## Second chance after the last heart (once per dive; Main decides whether it is offered).
	revived = true
	running = true
	_dying_t = -1.0
	_slow_t = 0.0
	hearts = mini(2, max_hearts)
	hearts_changed.emit()
	fish.revive()
	fish.invuln = 2.5
	for l: Lure in lures:
		l.light = 1.0
	shots.clear()
	_shove(fish.position, 700.0, 1400.0)
	for e: Enemy in enemies:
		if not e.dying and not e.boss and e.position.distance_squared_to(fish.position) < 480.0 * 480.0:
			_damage(e, 40.0 * stat_dmg)
	fx.ring(fish.position, 700.0, UI.GOLD, 0.8, 18.0)
	flashed.emit(UI.GOLD, 0.3)
	Sfx.play("levelup")
	Sfx.music("boss" if boss != null else "dive", 0.8)
	if boss != null:
		boss_changed.emit(boss)


func _offers() -> Array:
	var pool: Array = []
	for id: StringName in Mutations.LIST:
		if int(muts.get(id, 0)) < int(Mutations.LIST[id]["max"]):
			pool.append(id)
	var out: Array = []
	while out.size() < 3 and not pool.is_empty():
		var total := 0.0
		for id: StringName in pool:
			total += float(Mutations.LIST[id]["weight"])
		var pick := rng.randf() * total
		for id: StringName in pool:
			pick -= float(Mutations.LIST[id]["weight"])
			if pick <= 0.0:
				out.append(id)
				pool.erase(id)
				break
	if out.size() < 3:
		out.append(&"feast")
	if out.size() < 3:
		out.append(&"hoard")
	while out.size() < 3:
		out.append(&"hoard")
	return out


func choose(id: StringName) -> void:
	match id:
		&"feast":
			if hearts < max_hearts:
				hearts += 1
		&"hoard":
			pearls_run += 5
		_:
			muts[id] = int(muts.get(id, 0)) + 1
			if id == &"scales":
				max_hearts += 1
				hearts = mini(hearts + 1, max_hearts)
			_recompute()
	hearts_changed.emit()
	Sfx.play("pick")
	paused = false
	fish.invuln = maxf(fish.invuln, 0.9)
	fx.ring(fish.position, 260.0, Mutations.info(id)["color"], 0.5, 10.0)
	_lvl_delay = 0.45


func _recompute() -> void:
	var heavy: int = muts.get(&"heavy", 0)
	var stalk: int = muts.get(&"stalk", 0)
	var twin: int = muts.get(&"twin", 0)
	var meta_on := use_meta and not attract
	stat_dmg = (1.0 + 0.35 * heavy) * float(fdef["dmg"]) * (1.0 + 0.04 * (Meta.upgrade_level(&"weight") if meta_on else 0))
	stat_crit = 0.18 * int(muts.get(&"barbs", 0))
	stat_pickup = PICKUP_R * (1.0 + 0.45 * int(muts.get(&"magnet", 0))) * (1.0 + 0.08 * (Meta.upgrade_level(&"bait") if meta_on else 0))
	fish.speed = 520.0 * (1.0 + 0.1 * int(muts.get(&"fins", 0))) * float(fdef["speed"])
	while lures.size() < 1 + twin:
		var l := Lure.new()
		l.length = LURE_LEN * LURE_LEN_MULT[lures.size()]
		l.response = float(fdef["response"])
		l.keep_bonus = float(fdef["keep"])
		var glow := Meta.glow_id() if fish_kind == &"" else &""
		l.rainbow = bool(Meta.GLOWS[glow].get("rainbow", false))
		if lures.size() == 0:
			l.tint = fdef["tint"] if glow == &"" else Meta.GLOWS[glow]["color"]
		elif lures.size() == 1:
			l.tint = Color("7df0ff")
		elif lures.size() == 2:
			l.tint = Color("ff9be6")
		add_child(l)
		l.reset(fish.stalk_anchor())
		lures.append(l)
	for i in lures.size():
		var l := lures[i]
		l.length = LURE_LEN * LURE_LEN_MULT[i] * (1.0 + 0.18 * stalk) * float(fdef["len"])
		l.radius = LURE_R * (1.0 + 0.16 * heavy) * float(fdef["radius"])
		l.barbs = int(muts.get(&"barbs", 0))
		l.offset = TAU * i / lures.size()


# ------------------------------------------------------------------ abilities
func _abilities(dt: float) -> void:
	var pulse_lv: int = muts.get(&"pulse", 0)
	if pulse_lv > 0:
		_pulse_t -= dt
		if _pulse_t <= 0.0:
			_pulse_t = 4.4 - 0.55 * pulse_lv
			var r := 150.0 + 26.0 * pulse_lv
			var dmg := (12.0 + 7.0 * pulse_lv) * stat_dmg
			for l: Lure in lures:
				var p := l.head()
				fx.ring(p, r, UI.CYAN, 0.4, 12.0)
				fx.burst(p, UI.CYAN, 10, 420.0)
				for e: Enemy in enemies:
					if not e.dying and e.position.distance_squared_to(p) < (r + e.radius) * (r + e.radius):
						e.knock += (e.position - p).normalized() * 260.0 / e.mass
						_damage(e, dmg)
			Sfx.play("pulse", -7.0, randf_range(0.95, 1.1))
			shake(5.0)
	var tox_lv: int = muts.get(&"toxic", 0)
	if tox_lv > 0:
		for l: Lure in lures:
			if l.speed > 700.0 and l.toxic_cd <= 0.0:
				l.toxic_cd = 0.1
				clouds.append([l.head(), 1.6, 50.0 + 8.0 * tox_lv])
				if clouds.size() > 44:
					clouds.pop_front()
		_tox_tick -= dt
		var do_tick := _tox_tick <= 0.0
		if do_tick:
			_tox_tick = 0.25
		var dmg := (9.0 + 6.0 * tox_lv) * 0.25 * stat_dmg
		var ci := clouds.size() - 1
		var burned := false
		while ci >= 0:
			var c: Array = clouds[ci]
			c[1] -= dt
			if float(c[1]) <= 0.0:
				clouds.remove_at(ci)
			elif do_tick:
				var cp: Vector2 = c[0]
				var cr: float = c[2]
				for e: Enemy in enemies:
					if not e.dying and e.position.distance_squared_to(cp) < (cr + e.radius) * (cr + e.radius):
						_damage(e, dmg)
						burned = true
			ci -= 1
		if burned:
			Sfx.play("fizz", -16.0, randf_range(0.9, 1.2), 0.2)
	var crack_lv: int = muts.get(&"crack", 0)
	if crack_lv > 0:
		for l: Lure in lures:
			if l.speed > CRACK_SPEED and l.crack_cd <= 0.0:
				l.crack_cd = 1.25 - 0.2 * crack_lv
				var w := Wave.new()
				w.pos = l.head()
				w.vel = l.head_vel.normalized() * 1150.0
				w.dmg = (16.0 + 10.0 * crack_lv) * stat_dmg
				waves.append(w)
				Sfx.play("crack", -4.0, randf_range(0.92, 1.1))
				fx.burst(w.pos, Color.WHITE, 8, 500.0, 0.9, 0.3, w.vel.normalized(), 40.0)
	var wi := waves.size() - 1
	while wi >= 0:
		var w := waves[wi]
		w.life -= dt
		w.pos += w.vel * dt
		if w.life <= 0.0:
			waves.remove_at(wi)
		else:
			for e: Enemy in enemies:
				if e.dying or e in w.hit:
					continue
				if e.position.distance_squared_to(w.pos) < (w.r + e.radius) * (w.r + e.radius):
					w.hit.append(e)
					e.knock += w.vel.normalized() * 300.0 / e.mass
					_damage(e, w.dmg)
		wi -= 1


# ------------------------------------------------------------------ enemy shots
func shoot(pos: Vector2, vel: Vector2, color: Color, r := 12.0) -> void:
	if shots.size() > 260:
		return
	var s := Shot.new()
	s.pos = pos
	s.vel = vel
	s.color = color
	s.r = r
	shots.append(s)


func _tick_shots(dt: float) -> void:
	var fp := fish.position
	var i := shots.size() - 1
	while i >= 0:
		var s := shots[i]
		s.pos += s.vel * dt
		s.life -= dt
		var d2 := s.pos.distance_squared_to(fp)
		if fish.invuln <= 0.0 and d2 < (s.r + Fish.RADIUS * 0.6) * (s.r + Fish.RADIUS * 0.6):
			shots.remove_at(i)
			_hurt(s.pos, &"shot")
			break  # the hurt burst clears nearby shots, so the list just changed under us
		elif s.life <= 0.0 or d2 > 2200.0 * 2200.0:
			shots.remove_at(i)
		i -= 1


# ------------------------------------------------------------------ zones and bosses
func _tick_zone(dt: float) -> void:
	var zd := zone_def(zone)
	var zlen: float = zd["len"]
	if boss == null and not _boss_pending:
		zone_t += dt
		if zone_t >= zlen:
			_boss_pending = true
			_warn_t = 2.8
			var kind: StringName = zd["boss"] if zone < ZONES.size() - 1 else BOSS_CYCLE[(zone - (ZONES.size() - 1)) % 3]
			banner.emit("WARNING", Enemy.DEFS[kind]["title"], UI.RED)
			Sfx.play("warn")
			Sfx.music("boss", 1.5)
	elif _boss_pending:
		_warn_t -= dt
		if _warn_t <= 0.0:
			_boss_pending = false
			_spawn_boss()
	var d0 := zone_start_depth(zone)
	var d1 := zone_start_depth(zone + 1)
	depth = lerpf(d0, d1, minf(zone_t / zlen, 1.0) * 0.97)


func _boss_killed(e: Enemy) -> void:
	bosses_run += 1
	if _hearts_lost == _boss_hearts:
		flawless_run += 1
		items.text(fish.position + Vector2(0, -210), "UNTOUCHED!", UI.GOLD, 56, 1.6)
	boss = null
	boss_changed.emit(null)
	Sfx.play("boss_die")
	Sfx.buzz(160)
	Sfx.music("dive", 2.5)
	slowmo(0.22, 1.0)
	shake(40.0)
	flashed.emit(Color.WHITE, 0.6)
	for i in 5:
		fx.burst(e.position + Vector2.from_angle(i * 1.3) * e.radius * 0.5, e.color.lerp(Color.WHITE, i * 0.15), 26, 720.0, 2.0, 0.9)
	fx.ring(e.position, 900.0, Color.WHITE, 0.9, 22.0)
	fx.ring(e.position, 520.0, e.color, 0.7, 16.0)
	for i in e.xp:
		_drop(e.position + Vector2.from_angle(randf() * TAU) * randf_range(0, e.radius), 1 if i % 4 else 5, 0)
	for i in 6 + zone * 3:
		_drop(e.position, 1, 1)
	_drop(e.position, 1, 2)
	shots.clear()
	# the shockwave wipes out everything nearby
	for o: Enemy in enemies:
		if not o.dying and not o.boss and on_screen(o.position, 200.0):
			o.dying = true
			kills += 1
			fx.burst(o.position, o.color, 8, 320.0)
			_drop(o.position, o.xp, 0)
	zone += 1
	zone_t = 0.0
	depth = zone_start_depth(zone)
	var zd := zone_def(zone)
	bg.set_colors(zd["top"], zd["bot"], zd["rays"])
	banner.emit(zd["name"], "%s m" % UI.commas(int(depth)), UI.CYAN)
	_swarm_t = 14.0
	_elite_t = 20.0


func apply_zone_colors() -> void:
	var zd := zone_def(zone)
	bg.top = zd["top"]
	bg.bot = zd["bot"]
	bg.rays = zd["rays"]


# ------------------------------------------------------------------ automated player
func _bot_input(dt: float) -> void:
	## Plays like a competent person: keeps the thumb circling so the lure whirls, drifts the circle
	## toward plankton (or the boss), and breaks off only for things that are about to touch the fish.
	_bot_ang += dt * 7.0
	var fp := fish.position
	var move := Vector2.from_angle(_bot_ang)
	var away := Vector2.ZERO
	for e: Enemy in enemies:
		var d := fp - e.position
		var reach := (260.0 if e.boss else (55.0 if e.kind == &"krill" else 95.0)) + e.radius
		var l := d.length()
		if l < reach and l > 0.01:
			away += d / l * (1.0 - l / reach) * (2.5 if e.boss else 1.0)
	for s: Shot in shots:
		var d := fp - s.pos
		var l := d.length()
		if l < 170.0 and l > 0.01:
			away += d / l * (1.0 - l / 170.0) * 1.6
	var drift := Vector2.ZERO
	var best := 700.0 * 700.0
	for o: Orb in orbs:
		var d2 := o.pos.distance_squared_to(fp)
		if d2 < best:
			best = d2
			drift = (o.pos - fp).normalized()
	if boss != null and not boss.dying:
		var d := boss.position - fp
		var want := lures[0].length + boss.radius * 0.5
		if d.length() > want + 60.0:
			drift = d.normalized()
		elif d.length() < want - 60.0:
			drift = -d.normalized()
	input_vec = (move + drift * 0.5 + away * 1.6).limit_length(1.0)
