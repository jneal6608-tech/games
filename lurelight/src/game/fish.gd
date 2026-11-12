class_name Fish extends Node2D
## The player: a small anglerfish. Swims toward the joystick direction; the lure does the fighting.

const RADIUS := 28.0
const ACCEL := 4600.0
const ART_SCALE := 0.4

var speed := 520.0
var input_dir := Vector2.ZERO  # length 0..1
var vel := Vector2.ZERO
var facing := 1.0
var turn := 1.0  # smoothed facing (-1..1): the fish flips like a card instead of snapping
var invuln := 0.0
var dead := false
var size := 1.0
var art := ""  # texture suffix: "" is the starting anglerfish (see tools/gen_fish.py)

var _rig: Node2D
var _body: Sprite2D
var _tail: Sprite2D
var _t := 0.0
var _tilt := 0.0
var _squash := 0.0


func _ready() -> void:
	z_index = 5
	_rig = Node2D.new()
	add_child(_rig)
	scale = Vector2(size, size)
	_tail = Sprite2D.new()
	_tail.texture = load("res://assets/art/fish_tail%s.svg" % art)
	_tail.centered = false
	_tail.offset = Vector2(-116, -80)
	_tail.position = Vector2(-37, 1)
	_tail.scale = Vector2(ART_SCALE, ART_SCALE)
	_rig.add_child(_tail)
	_body = Sprite2D.new()
	_body.texture = load("res://assets/art/fish_body%s.svg" % art)
	_body.scale = Vector2(ART_SCALE, ART_SCALE)
	_rig.add_child(_body)


func revive() -> void:
	dead = false
	vel = Vector2.ZERO
	_rig.rotation = 0.0
	_rig.modulate = Color.WHITE


func tick(dt: float) -> void:
	_t += dt
	if dead:
		vel = vel.move_toward(Vector2(0, 90), 500.0 * dt)
		position += vel * dt
		_rig.rotation += 1.6 * dt * facing
		_rig.modulate = _rig.modulate.lerp(Color(0.35, 0.3, 0.5, 0.85), minf(1.0, dt * 2.0))
		return
	vel = vel.move_toward(input_dir * speed, ACCEL * dt)
	position += vel * dt
	if absf(vel.x) > 60.0:
		facing = signf(vel.x)
	var sp := vel.length() / speed
	_tilt = lerpf(_tilt, clampf(vel.y / speed, -1.0, 1.0) * 0.38, minf(1.0, dt * 10.0))
	_squash = lerpf(_squash, 0.0, minf(1.0, dt * 9.0))
	turn = move_toward(turn, facing, dt * 9.0)
	var flip := turn if absf(turn) > 0.12 else 0.12 * signf(turn if turn != 0.0 else facing)
	_rig.scale = Vector2(flip * (1.0 + _squash * 0.25), 1.0 - _squash * 0.2)
	_rig.rotation = _tilt * facing
	_tail.rotation = sin(_t * (7.0 + sp * 11.0)) * (0.22 + sp * 0.3)
	_body.position.y = sin(_t * 2.4) * 2.0
	if invuln > 0.0:
		invuln -= dt
		_rig.modulate.a = 0.45 + 0.4 * absf(sin(_t * 26.0))
	else:
		_rig.modulate.a = 1.0


func stalk_anchor() -> Vector2:
	return position + Vector2(16.0 * turn, -33.0) * size


func bump() -> void:
	_squash = 1.0
