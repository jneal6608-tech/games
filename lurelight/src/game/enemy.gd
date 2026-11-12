class_name Enemy extends Node2D
## A creature of the deep. The world owns the list and calls tick(); behaviour is chosen by `kind`.

const DEFS := {
	&"krill": {"scale": 0.42, "r": 20.0, "hp": 4.0, "speed": 100.0, "xp": 1, "mass": 0.6, "face": 1, "color": Color("4fe3ff")},
	&"jelly": {"scale": 0.42, "r": 34.0, "hp": 30.0, "speed": 64.0, "xp": 2, "mass": 1.4, "face": 0, "color": Color("ff6fd8"), "offset": Vector2(0, 50)},
	&"darter": {"scale": 0.42, "r": 22.0, "hp": 14.0, "speed": 135.0, "xp": 2, "mass": 0.8, "face": 1, "color": Color("b6ff5c")},
	&"squid": {"scale": 0.42, "r": 28.0, "hp": 24.0, "speed": 115.0, "xp": 3, "mass": 1.0, "face": 2, "color": Color("9b7bff"), "offset": Vector2(0, 30)},
	&"urchin": {"scale": 0.44, "r": 34.0, "hp": 44.0, "speed": 60.0, "xp": 4, "mass": 2.6, "face": 3, "color": Color("ff7a4a"), "armored": true},
	&"eel": {"scale": 0.45, "r": 24.0, "hp": 30.0, "speed": 195.0, "xp": 3, "mass": 1.0, "face": 1, "color": Color("ff4a6a")},
	&"bloom": {"tex": "boss_bloom", "scale": 0.62, "r": 118.0, "hp": 680.0, "speed": 78.0, "xp": 40, "mass": 40.0, "face": 0,
		"color": Color("ff5ac8"), "offset": Vector2(0, 130), "boss": true, "title": "THE BLOOM"},
	&"gulper": {"tex": "boss_gulper", "scale": 0.55, "r": 96.0, "hp": 1150.0, "speed": 95.0, "xp": 60, "mass": 40.0, "face": 1,
		"color": Color("ff3a5a"), "offset": Vector2(-120, 0), "boss": true, "title": "THE GULPER"},
	&"warden": {"tex": "boss_warden", "scale": 0.55, "r": 112.0, "hp": 1500.0, "speed": 58.0, "xp": 80, "mass": 60.0, "face": 3,
		"color": Color("ff8a3a"), "boss": true, "armored": true, "title": "THE WARDEN"},
}

const SQUID_CHARGE := 0.7
const SQUID_SHOT_SPEED := 290.0

static var _tex := {}

var kind: StringName
var hp := 1.0
var max_hp := 1.0
var radius := 20.0
var speed := 100.0
var xp := 1
var mass := 1.0
var color := Color.WHITE
var armored := false
var boss := false
var elite := false
var title := ""
var vel := Vector2.ZERO
var knock := Vector2.ZERO
var state := 0
var timer := 0.0
var timer2 := 0.0
var aim := Vector2.RIGHT
var hit_cd := PackedFloat32Array([0.0, 0.0, 0.0])
var flash := 0.0
var dying := false
var telegraph := 0.0  # 0..1, drawn by the world as a warning for dashes

var _sprite: Sprite2D
var _flash: Sprite2D
var _face := 0
var _base_scale := 1.0
var _t := 0.0
var _spin := 0.0


static func tex(name: String) -> Texture2D:
	if not _tex.has(name):
		_tex[name] = load("res://assets/art/%s.svg" % name)
	return _tex[name]


func setup(k: StringName, hp_mult: float, speed_mult: float, make_elite := false) -> void:
	kind = k
	var d: Dictionary = DEFS[k]
	radius = d["r"]
	max_hp = float(d["hp"]) * hp_mult
	speed = float(d["speed"]) * speed_mult
	xp = d["xp"]
	mass = d["mass"]
	color = d["color"]
	armored = d.get("armored", false)
	boss = d.get("boss", false)
	title = d.get("title", "")
	_face = d["face"]
	_base_scale = d["scale"]
	elite = make_elite
	if elite:
		max_hp *= 5.0
		radius *= 1.35
		_base_scale *= 1.4
		xp *= 5
		mass *= 2.5
	hp = max_hp
	_t = randf() * 10.0
	timer = randf_range(1.0, 2.5)
	var t: Texture2D = tex(d.get("tex", String(k)))
	_sprite = Sprite2D.new()
	_sprite.texture = t
	_sprite.offset = d.get("offset", Vector2.ZERO)
	_sprite.scale = Vector2(_base_scale, _base_scale)
	add_child(_sprite)
	_flash = Sprite2D.new()
	_flash.texture = t
	_flash.offset = _sprite.offset
	_flash.material = UI.additive()
	_flash.visible = false
	_sprite.add_child(_flash)
	if elite:
		_sprite.modulate = Color(1.25, 1.1, 0.8)
	z_index = 3 if boss else 1


func tick(dt: float, w: World) -> void:
	_t += dt
	for i in 3:
		if hit_cd[i] > 0.0:
			hit_cd[i] -= dt
	var to := w.fish.position - position
	var dist := to.length()
	var dir := to / maxf(dist, 0.001)
	var sx := 1.0
	var sy := 1.0
	telegraph = 0.0
	match kind:
		&"krill":
			var wob := dir.orthogonal() * sin(_t * 5.0) * 0.35
			vel = vel.lerp((dir + wob) * speed, minf(1.0, dt * 4.0))
		&"jelly":
			var ph := sin(_t * 3.2)
			vel = dir * speed * (0.35 + 1.5 * maxf(0.0, ph))
			sx = 1.0 - ph * 0.1
			sy = 1.0 + ph * 0.13
		&"darter":
			match state:
				0:
					vel = vel.lerp(dir * speed, minf(1.0, dt * 3.0))
					timer -= dt
					if dist < 560.0 and timer <= 0.0:
						state = 1
						timer = 0.7
				1:
					vel = vel.lerp(Vector2.ZERO, minf(1.0, dt * 8.0))
					aim = dir
					telegraph = 1.0 - timer / 0.7
					flash = maxf(flash, 0.35 * telegraph)
					timer -= dt
					if timer <= 0.0:
						state = 2
						timer = 0.5
						vel = aim * 640.0
						if w.on_screen(position):
							Sfx.play("dash", -8.0, randf_range(0.95, 1.15), 0.08)
				2:
					timer -= dt
					sx = 1.25
					sy = 0.8
					if timer <= 0.0:
						state = 0
						timer = randf_range(1.2, 2.2)
		&"squid":
			var want := 440.0
			var move := dir.orthogonal() * (1.0 if int(_t * 0.2) % 2 == 0 else -1.0) * 0.6
			if dist > want + 70.0:
				move += dir
			elif dist < want - 90.0:
				move -= dir * 1.2
			vel = vel.lerp(move.normalized() * speed, minf(1.0, dt * 2.5))
			sy = 1.0 + sin(_t * 6.0) * 0.06
			timer -= dt
			match state:
				0:
					# only fire from well inside the screen, and only when the world allows another volley,
					# so a crowd of squid can never fire at once
					if timer <= 0.0 and w.on_screen(position, -90.0) and w.claim_squid_volley():
						state = 1
						timer = SQUID_CHARGE
						aim = dir  # locked: the shot goes where the fish was, so moving dodges it
				1:
					vel = vel.lerp(Vector2.ZERO, minf(1.0, dt * 6.0))
					telegraph = 1.0 - timer / SQUID_CHARGE
					flash = maxf(flash, 0.55 * telegraph)
					sx = 1.0 + 0.22 * telegraph
					sy = 1.0 + 0.22 * telegraph
					if timer <= 0.0:
						w.shoot(position + aim * radius, aim * SQUID_SHOT_SPEED, color, 19.0)
						flash = 0.8
						Sfx.play("spit", -8.0, randf_range(0.9, 1.1), 0.06)
						state = 0
						timer = randf_range(3.0, 3.8)
		&"urchin":
			vel = vel.lerp(dir * speed, minf(1.0, dt * 2.0))
			_spin += dt * 1.1
		&"eel":
			var cur := vel.angle() if vel.length_squared() > 1.0 else dir.angle()
			var ang := rotate_toward(cur, dir.angle(), 2.3 * dt)
			vel = Vector2.from_angle(ang + sin(_t * 7.0) * 0.12) * speed
		&"bloom":
			_tick_bloom(dt, w, dir)
			var ph2 := sin(_t * 2.2)
			sx = 1.0 - ph2 * 0.05
			sy = 1.0 + ph2 * 0.06
		&"gulper":
			_tick_gulper(dt, w, dir, dist)
		&"warden":
			_tick_warden(dt, w, dir)
	position += (vel + knock) * dt
	knock *= exp(-6.5 * dt)
	# face / animate
	match _face:
		1:
			var a := (aim if (kind == &"darter" and state == 1) or (kind == &"gulper" and state == 1) else vel).angle()
			if vel.length_squared() > 4.0 or state == 1:
				_sprite.rotation = lerp_angle(_sprite.rotation, a, minf(1.0, dt * 12.0))
			_sprite.flip_v = absf(angle_difference(0.0, _sprite.rotation)) > PI / 2.0
			_flash.flip_v = _sprite.flip_v
		2:
			if vel.length_squared() > 4.0:
				_sprite.rotation = lerp_angle(_sprite.rotation, vel.angle() + PI / 2.0, minf(1.0, dt * 5.0))
		3:
			_sprite.rotation = _spin
		_:
			_sprite.rotation = lerpf(_sprite.rotation, clampf(vel.x / 300.0, -0.25, 0.25), minf(1.0, dt * 4.0))
	var pop := 1.0 + flash * 0.12
	_sprite.scale = Vector2(_base_scale * sx * pop, _base_scale * sy * pop)
	if flash > 0.01:
		flash = maxf(0.0, flash - dt * 5.0)
		_flash.visible = true
		_flash.modulate = Color(1, 1, 1, minf(1.0, flash))
	else:
		_flash.visible = false


func _tick_bloom(dt: float, w: World, dir: Vector2) -> void:
	var enraged := hp < max_hp * 0.5
	vel = vel.lerp(dir * speed * (1.3 if enraged else 1.0), minf(1.0, dt * 1.5))
	timer -= dt
	match state:
		0:
			if timer <= 0.0:
				state = 1
				timer = 0.7
		1:
			flash = maxf(flash, 0.5)
			if timer <= 0.0:
				var n := 14
				var off := randf() * TAU
				for i in n:
					w.shoot(position, Vector2.from_angle(off + TAU * i / n) * 290.0, color, 15.0)
				if enraged:
					for i in n:
						w.shoot(position, Vector2.from_angle(off + TAU * (i + 0.5) / n) * 190.0, color, 15.0)
					w.spawn_ring(&"krill", 5, 420.0)
				Sfx.play("pulse", -3.0, 0.8)
				w.fx.ring(position, radius * 2.2, color, 0.5)
				state = 0
				timer = 2.6 if enraged else 3.3


func _tick_gulper(dt: float, w: World, dir: Vector2, dist: float) -> void:
	var enraged := hp < max_hp * 0.5
	timer -= dt
	match state:
		0:  # stalk
			vel = vel.lerp(dir * speed, minf(1.0, dt * 2.0))
			if timer <= 0.0:
				state = 1
				timer = 0.75 if enraged else 0.95
				aim = dir
				Sfx.play("warn", -6.0, 1.5)
		1:  # aim: track for the first part, then lock
			vel = vel.lerp(-aim * 60.0, minf(1.0, dt * 5.0))
			if timer > 0.3:
				aim = aim.slerp(dir, minf(1.0, dt * 6.0))
			telegraph = 1.0 - timer / 0.95
			flash = maxf(flash, 0.3)
			if timer <= 0.0:
				state = 2
				timer = clampf((dist + 420.0) / 1250.0, 0.5, 1.0)
				vel = aim * 1250.0
				Sfx.play("dash", 0.0, 0.7)
		2:  # dash
			if timer <= 0.0:
				state = 3
				timer = 0.9
				timer2 = 0.0
		3:  # spit, recover
			vel = vel.lerp(Vector2.ZERO, minf(1.0, dt * 4.0))
			timer2 -= dt
			if timer2 <= 0.0:
				timer2 = 0.3
				var spread := 5 if enraged else 3
				for i in spread:
					w.shoot(position, dir.rotated((i - (spread - 1) / 2.0) * 0.26) * 360.0, color, 15.0)
				Sfx.play("spit", -4.0, 0.7)
			if timer <= 0.0:
				state = 0
				timer = 1.1 if enraged else 1.7


func _tick_warden(dt: float, w: World, dir: Vector2) -> void:
	var enraged := hp < max_hp * 0.5
	vel = vel.lerp(dir * speed, minf(1.0, dt * 1.5))
	timer -= dt
	match state:
		0:  # rest: slow spin
			_spin += dt * 0.6
			if timer <= 0.0:
				state = 1
				timer = 3.2
				timer2 = 0.0
				Sfx.play("warn", -6.0, 1.2)
		1:  # spiral barrage
			_spin += dt * (2.4 if enraged else 1.8)
			timer2 -= dt
			if timer2 <= 0.0:
				timer2 = 0.14
				var arms := 3 if enraged else 2
				for i in arms:
					w.shoot(position + Vector2.from_angle(_spin + TAU * i / arms) * radius * 0.8, Vector2.from_angle(_spin + TAU * i / arms) * 270.0, color, 14.0)
				Sfx.play("spit", -12.0, 1.3, 0.1)
			if timer <= 0.0:
				state = 0
				timer = 2.6 if enraged else 3.2


func interrupt() -> void:
	## A solid lure hit cancels a squid's shot mid-charge: hitting the shooter is always an answer.
	if kind == &"squid" and state == 1:
		state = 0
		timer = 1.4
		telegraph = 0.0


func hurt_flash(amount := 1.0) -> void:
	flash = maxf(flash, amount)
