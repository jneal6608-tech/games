class_name Lure extends Node2D
## One glowing lure on a springy stalk.
##
## Model: the lure streams behind the direction the fish is swimming, like a streamer in a current,
## and it has momentum. So when the player circles their thumb the trailing direction rotates and the
## lure whirls around the fish at the same rate: spin faster, whirl faster. Reverse direction and it
## whips around to the other side. Swim straight and it settles behind you; stop and it coasts.
## Stepped at a fixed 120 Hz so it feels identical at any frame rate.
##
## The node stays at the world origin; everything is drawn in world space.

const ALIGN := 150.0  # how hard the lure is pulled toward the trailing direction (rad/s^2)
const DAMP := 6.5  # angular drag (1/s). ALIGN / DAMP is the fastest whirl the lure can follow.
const DAMP_QUAD := 0.35  # extra drag that grows with speed: sets the top whirl speed
const FULL_SPEED := 420.0  # fish speed at which the pull reaches full strength
const TRAIL_LEN := 14
const CURVE_PTS := 11

var length := 230.0
var radius := 24.0
var barbs := 0
var tint := Color("ffe27a")
var pos := Vector2.ZERO
var head_vel := Vector2.ZERO
var speed := 0.0
var last_head := Vector2.ZERO
var crack_cd := 0.0
var toxic_cd := 0.0
var light := 1.0  # fades to 0 when the fish dies

var rainbow := false  # Aurora glow: the colour drifts through the spectrum
var response := 1.0  # scales ALIGN and both drags together: quicker or slower to follow, same top whirl speed
var keep_bonus := 0.0  # 0..1: how much of the momentum normally lost in a hit is kept (heavy lures plough through)

var ang := 2.2  # direction from the fish to the lure
var omega := 0.0  # angular speed (rad/s)
var offset := 0.0  # extra lures fan out around the fish by this angle
var stretch := 0.0

var _anchor := Vector2.ZERO
var _bend := Vector2.ZERO
var _stalk: Line2D
var _trail: Line2D
var _halo: Sprite2D
var _trail_pts: Array[Vector2] = []
var _pulse := 0.0


func set_tint(c: Color) -> void:
	tint = c
	if _stalk != null:
		_stalk.gradient.set_color(2, c)


func _ready() -> void:
	z_index = 6
	_trail = Line2D.new()
	_trail.material = UI.additive()
	_trail.joint_mode = Line2D.LINE_JOINT_ROUND
	_trail.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_trail.end_cap_mode = Line2D.LINE_CAP_ROUND
	var wc := Curve.new()
	wc.add_point(Vector2(0, 0.0))
	wc.add_point(Vector2(1, 1.0))
	_trail.width_curve = wc
	var tg := Gradient.new()
	tg.offsets = PackedFloat32Array([0.0, 1.0])
	tg.colors = PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 1)])
	_trail.gradient = tg
	add_child(_trail)

	_stalk = Line2D.new()
	_stalk.width = 9.0
	_stalk.joint_mode = Line2D.LINE_JOINT_ROUND
	_stalk.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_stalk.end_cap_mode = Line2D.LINE_CAP_ROUND
	var sc := Curve.new()
	sc.add_point(Vector2(0, 1.0))
	sc.add_point(Vector2(1, 0.4))
	_stalk.width_curve = sc
	var sg := Gradient.new()
	sg.offsets = PackedFloat32Array([0.0, 0.7, 1.0])
	sg.colors = PackedColorArray([Color("5a2a82"), Color("c05a9a"), tint])
	_stalk.gradient = sg
	add_child(_stalk)

	_halo = Sprite2D.new()
	_halo.texture = UI.glow()
	_halo.material = UI.additive()
	add_child(_halo)


func reset(anchor: Vector2) -> void:
	_anchor = anchor
	ang = 2.2 + offset
	omega = 0.0
	pos = anchor + Vector2.from_angle(ang) * length
	head_vel = Vector2.ZERO
	last_head = pos
	_bend = Vector2.ZERO
	_trail_pts.clear()


func head() -> Vector2:
	return pos


func anchor() -> Vector2:
	return _anchor


func step(anchor: Vector2, anchor_vel: Vector2, h: float) -> void:
	_anchor = anchor
	var sp := anchor_vel.length()
	if sp > 1.0:
		var target := (-anchor_vel).angle() + offset
		omega += ALIGN * response * minf(sp / FULL_SPEED, 1.0) * sin(target - ang) * h
	omega -= omega * minf(1.0, (DAMP + DAMP_QUAD * absf(omega)) * response * h)
	ang += omega * h
	# the stalk stretches a little under a fast swing
	stretch = lerpf(stretch, minf(omega * omega * 0.0014, 0.2), minf(1.0, h * 14.0))
	var p0 := pos
	pos = anchor + Vector2.from_angle(ang) * length * (1.0 + stretch)
	head_vel = (pos - p0) / h


func slow(keep: float) -> void:
	## Lose some momentum on impact so hits feel like they connect.
	omega *= lerpf(keep, 1.0, keep_bonus)


func bounce(_normal: Vector2, keep := 0.6) -> void:
	omega = -omega * keep


func heat() -> float:
	return clampf((speed - 400.0) / 1800.0, 0.0, 1.0)


func post_step(real_dt: float) -> void:
	speed = lerpf(speed, head_vel.length(), 0.5)
	crack_cd = maxf(0.0, crack_cd - real_dt)
	toxic_cd = maxf(0.0, toxic_cd - real_dt)
	_pulse += real_dt
	if rainbow:
		set_tint(Color.from_hsv(fmod(_pulse * 0.22 + offset * 0.16, 1.0), 0.5, 1.0))
	_trail_pts.append(pos)
	if _trail_pts.size() > TRAIL_LEN:
		_trail_pts.pop_front()
	var h := heat()
	_trail.points = PackedVector2Array(_trail_pts)
	_trail.width = radius * (1.0 + h * 0.5)
	var tc := tint.lerp(Color.WHITE, h * h * 0.35)
	tc.a = (0.05 + h * 0.5) * light
	_trail.default_color = tc
	# the stalk is drawn as a curve that bows against the direction of the swing
	var mid := (_anchor + pos) * 0.5
	var want_bend := -head_vel * 0.035
	_bend = _bend.lerp(want_bend.limit_length(length * 0.3), minf(1.0, real_dt * 12.0))
	var ctrl := mid + _bend * 2.0
	var pts := PackedVector2Array()
	pts.resize(CURVE_PTS)
	for i in CURVE_PTS:
		var t := float(i) / (CURVE_PTS - 1)
		pts[i] = _anchor * ((1.0 - t) * (1.0 - t)) + ctrl * (2.0 * (1.0 - t) * t) + pos * (t * t)
	_stalk.points = pts
	_halo.position = pos
	var hs := radius / 64.0 * (3.4 + h * 2.2 + sin(_pulse * 5.0) * 0.15)
	_halo.scale = Vector2(hs, hs)
	_halo.modulate = Color(tint.r, tint.g, tint.b, (0.55 + h * 0.35) * light)
	queue_redraw()


func _draw() -> void:
	var p := pos
	var h := heat()
	if barbs > 0:
		var n := 6 + barbs * 2
		var spin := _pulse * (1.5 + h * 6.0)
		var col := Color("fff6e0") * Color(1, 1, 1, light)
		for i in n:
			var a := spin + TAU * i / n
			var dir := Vector2.from_angle(a)
			var side := dir.orthogonal() * radius * 0.22
			draw_colored_polygon(PackedVector2Array([p + dir * radius * 0.7 + side, p + dir * radius * (1.35 + 0.1 * barbs), p + dir * radius * 0.7 - side]), col)
	var body := tint.lerp(Color.WHITE, 0.25 + h * 0.5)
	body.a = 0.35 + 0.65 * light
	draw_circle(p, radius, body.darkened(0.25 * (1.0 - light)))
	draw_circle(p, radius * 0.62, Color(1, 1, 1, 0.9 * light))
	draw_arc(p, radius, 0, TAU, 28, Color(tint.r, tint.g * 0.8, tint.b * 0.5, 0.9 * light + 0.1), 2.5, true)
