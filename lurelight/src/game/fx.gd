class_name Fx extends Node2D
## Additive effects layer: particles, rings, lightning, plus the glowing gameplay objects
## (plankton, enemy shots, poison clouds, whipcrack waves, dash warnings) so they share one draw call path.

var world: World
var rings: Array = []
var bolts: Array = []

const MAX_PARTICLES := 700

var _pp := PackedVector2Array()  # position
var _pv := PackedVector2Array()  # velocity
var _pd := PackedFloat32Array()  # deceleration
var _pl := PackedFloat32Array()  # life left
var _pm := PackedFloat32Array()  # life total
var _ps := PackedFloat32Array()  # radius
var _pc := PackedColorArray()


func _ready() -> void:
	z_index = 4
	material = UI.additive()


func burst(pos: Vector2, color: Color, amount: int, speed: float, size := 1.0, life := 0.45, dir := Vector2.ZERO, spread := 180.0) -> void:
	## Particles are plain data drawn by this node: no nodes or GPU buffers are created per hit or kill,
	## which keeps memory flat however long a dive lasts (browsers on phones are sensitive to that churn).
	var base := dir.angle() if dir != Vector2.ZERO else 0.0
	var spr := deg_to_rad(spread)
	for i in maxi(1, amount):
		if _pp.size() >= MAX_PARTICLES:
			_kill_particle(0)
		var v := randf_range(0.25, 1.0) * speed
		_pp.append(pos)
		_pv.append(Vector2.from_angle(base + randf_range(-spr, spr)) * v)
		_pd.append(randf_range(1.2, 2.2) * speed)
		_pl.append(life)
		_pm.append(life)
		_ps.append(randf_range(0.1, 0.28) * size * 64.0)
		_pc.append(color)


func _kill_particle(i: int) -> void:
	var last := _pp.size() - 1
	_pp[i] = _pp[last]
	_pv[i] = _pv[last]
	_pd[i] = _pd[last]
	_pl[i] = _pl[last]
	_pm[i] = _pm[last]
	_ps[i] = _ps[last]
	_pc[i] = _pc[last]
	_pp.resize(last)
	_pv.resize(last)
	_pd.resize(last)
	_pl.resize(last)
	_pm.resize(last)
	_ps.resize(last)
	_pc.resize(last)


func particle_count() -> int:
	return _pp.size()


func ring(pos: Vector2, radius: float, color: Color, life := 0.4, width := 7.0) -> void:
	rings.append([pos, radius, life, life, color, width])


func bolt(a: Vector2, b: Vector2, color: Color) -> void:
	var pts := PackedVector2Array([a])
	var n := maxi(2, int(a.distance_to(b) / 45.0))
	var perp := (b - a).normalized().orthogonal()
	for i in range(1, n):
		pts.append(a.lerp(b, float(i) / n) + perp * randf_range(-22.0, 22.0))
	pts.append(b)
	bolts.append([pts, 0.16, color])


func tick(dt: float) -> void:
	var pi_ := _pp.size() - 1
	while pi_ >= 0:
		_pl[pi_] -= dt
		if _pl[pi_] <= 0.0:
			_kill_particle(pi_)
		else:
			var v := _pv[pi_]
			var sp := v.length()
			if sp > 0.0:
				v *= maxf(0.0, sp - _pd[pi_] * dt) / sp
				_pv[pi_] = v
			_pp[pi_] += v * dt
		pi_ -= 1
	for i in range(rings.size() - 1, -1, -1):
		rings[i][2] -= dt
		if rings[i][2] <= 0.0:
			rings.remove_at(i)
	for i in range(bolts.size() - 1, -1, -1):
		bolts[i][1] -= dt
		if bolts[i][1] <= 0.0:
			bolts.remove_at(i)
	queue_redraw()


func _draw() -> void:
	var glow := UI.glow()
	var w := world
	var t := w.real_t
	# poison clouds
	for c: Array in w.clouds:
		var k: float = clampf(float(c[1]) / 1.6, 0.0, 1.0)
		var r: float = float(c[2]) * (1.35 - k * 0.35)
		var cp: Vector2 = c[0]
		draw_texture_rect(glow, Rect2(cp - Vector2(r, r) * 1.3, Vector2(r, r) * 2.6), false, Color(0.45, 1.0, 0.25, 0.34 * k))
	# plankton
	for o: World.Orb in w.orbs:
		if o.kind != 0:
			continue
		var s := 15.0 + minf(float(o.value), 12.0) * 2.2 + sin(t * 6.0 + o.phase) * 2.0
		var col := Color(0.49, 1.0, 0.8, 0.95) if o.value < 5 else Color(1.0, 0.9, 0.45, 0.95)
		draw_texture_rect(glow, Rect2(o.pos - Vector2(s, s), Vector2(s, s) * 2.0), false, col)
		draw_circle(o.pos, s * 0.2, Color(1, 1, 1, 0.9))
	# dash warnings
	for e: Enemy in w.enemies:
		if e.telegraph > 0.0:
			var len := 1300.0 if e.boss else (560.0 if e.kind == &"squid" else 330.0)
			var wd := e.radius * 1.5 if e.boss else 10.0
			var la := (0.25 + 0.5 * e.telegraph) if e.kind == &"squid" else (0.12 + 0.3 * e.telegraph)
			draw_line(e.position, e.position + e.aim * len, Color(1.0, 0.2, 0.3, la), wd * (0.4 + 0.6 * e.telegraph))
	# enemy shots
	for s: World.Shot in w.shots:
		var r := s.r * (2.6 + 0.3 * sin(t * 14.0 + s.pos.x))
		draw_texture_rect(glow, Rect2(s.pos - Vector2(r, r), Vector2(r, r) * 2.0), false, Color(1.0, 0.25, 0.35, 0.8))
	# whipcrack waves
	for wv: World.Wave in w.waves:
		var k := clampf(wv.life / 0.55, 0.0, 1.0)
		var ang := wv.vel.angle()
		draw_arc(wv.pos - wv.vel.normalized() * wv.r * 0.6, wv.r, ang - 0.95, ang + 0.95, 14, Color(0.85, 0.97, 1.0, 0.9 * k), 5.0 + 12.0 * k, true)
	for k in _pp.size():
		var rad := _ps[k] * (_pl[k] / _pm[k])
		draw_texture_rect(glow, Rect2(_pp[k] - Vector2(rad, rad), Vector2(rad, rad) * 2.0), false, _pc[k])
	for r: Array in rings:
		var k: float = float(r[2]) / float(r[3])
		var c: Color = r[4]
		draw_arc(r[0], float(r[1]) * (1.0 - k * k), 0.0, TAU, 40, Color(c.r, c.g, c.b, k), float(r[5]) * (0.3 + k), true)
	for b: Array in bolts:
		var c: Color = b[2]
		var k: float = float(b[1]) / 0.16
		draw_polyline(b[0], Color(c.r, c.g, c.b, k), 7.0 * k + 2.0, true)
		draw_polyline(b[0], Color(1, 1, 1, k), 2.5, true)
