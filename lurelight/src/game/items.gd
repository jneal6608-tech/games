class_name Items extends Node2D
## Normal-blend layer: pearls, hearts and floating text.

var world: World
var floaters: Array = []

var _pearl: Texture2D
var _heart: Texture2D


func _ready() -> void:
	z_index = 7
	_pearl = load("res://assets/art/pearl.svg")
	_heart = load("res://assets/art/heart.svg")


func text(pos: Vector2, s: String, color: Color, size := 44, life := 0.9) -> void:
	floaters.append([pos, s, color, size, life, life])
	if floaters.size() > 24:
		floaters.pop_front()


func tick(dt: float) -> void:
	for i in range(floaters.size() - 1, -1, -1):
		var f: Array = floaters[i]
		f[4] -= dt
		f[0] += Vector2(0, -70.0 * dt)
		if f[4] <= 0.0:
			floaters.remove_at(i)
	queue_redraw()


func _draw() -> void:
	var t := world.real_t
	for o: World.Orb in world.orbs:
		if o.kind == 0:
			continue
		var bob := Vector2(0, sin(t * 4.0 + o.phase) * 4.0)
		if o.kind == 1:
			draw_texture_rect(_pearl, Rect2(o.pos + bob - Vector2(26, 26), Vector2(52, 52)), false)
		else:
			var s := 30.0 + sin(t * 5.0 + o.phase) * 3.0
			draw_texture_rect(_heart, Rect2(o.pos + bob - Vector2(s, s), Vector2(s, s) * 2.0), false)
	# enemy shot cores sit on the normal-blend layer with a dark rim, so they stay readable over any glow
	for s: World.Shot in world.shots:
		draw_circle(s.pos, s.r * 1.0, Color(0.16, 0.0, 0.06, 0.95))
		draw_circle(s.pos, s.r * 0.78, Color(1.0, 0.38, 0.45))
		draw_circle(s.pos, s.r * 0.4, Color(1, 1, 0.92))
	var font := UI.font("black")
	for f: Array in floaters:
		var k: float = float(f[4]) / float(f[5])
		# the pop-in is a scale transform, not a bigger font size: each distinct font size builds its own
		# glyph textures, and those would pile up over a long dive
		var size: int = f[3]
		var sc := 1.0 + 0.5 * maxf(0.0, k - 0.8) * 5.0
		var s: String = f[1]
		var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		var c: Color = f[2]
		var a := clampf(k * 3.0, 0.0, 1.0)
		draw_set_transform(f[0], 0.0, Vector2(sc, sc))
		draw_string_outline(font, Vector2(-w * 0.5, 0), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 10, Color(0.02, 0.04, 0.1, 0.85 * a))
		draw_string(font, Vector2(-w * 0.5, 0), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(c.r, c.g, c.b, a))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
