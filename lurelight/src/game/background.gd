class_name Background extends CanvasLayer
## Water: a vertical gradient that shifts per depth zone, light shafts near the surface,
## big soft glows and drifting marine snow with parallax. Drawn behind the world.

const TILE := Vector2(1500, 2600)

var cam_pos := Vector2.ZERO
var top := Color("0d4468")
var bot := Color("051326")
var rays := 1.0

var _grad: Gradient
var _rect: TextureRect
var _snow: Node2D
var _motes: Array = []
var _blobs: Array = []
var _t := 0.0
var _vp := Vector2(1080, 1920)


func _ready() -> void:
	layer = -5
	_grad = Gradient.new()
	_grad.offsets = PackedFloat32Array([0.0, 1.0])
	_grad.colors = PackedColorArray([top, bot])
	var gt := GradientTexture2D.new()
	gt.gradient = _grad
	gt.fill_from = Vector2(0.5, 0.0)
	gt.fill_to = Vector2(0.5, 1.0)
	gt.width = 4
	gt.height = 256
	_rect = TextureRect.new()
	_rect.texture = gt
	_rect.stretch_mode = TextureRect.STRETCH_SCALE
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_rect)
	_snow = Node2D.new()
	_snow.material = UI.additive()
	_snow.draw.connect(_draw_snow)
	add_child(_snow)
	var r := RandomNumberGenerator.new()
	r.seed = 11
	for i in 70:
		var layer_i := i % 3
		_motes.append([Vector2(r.randf() * TILE.x, r.randf() * TILE.y), [0.18, 0.42, 0.85][layer_i], [5.0, 8.0, 13.0][layer_i] * r.randf_range(0.7, 1.3),
			[0.22, 0.34, 0.5][layer_i] * r.randf_range(0.6, 1.0), r.randf() * TAU])
	for i in 6:
		_blobs.append([Vector2(r.randf() * TILE.x, r.randf() * TILE.y), r.randf_range(380.0, 700.0), r.randf() * TAU])


func set_colors(t: Color, b: Color, ray_amount: float, fade := 2.5) -> void:
	var tw := create_tween().set_parallel(true)
	tw.tween_property(self, "top", t, fade)
	tw.tween_property(self, "bot", b, fade)
	tw.tween_property(self, "rays", ray_amount, fade)


func tick(dt: float, cam: Vector2) -> void:
	_t += dt
	cam_pos = cam
	_grad.set_color(0, top)
	_grad.set_color(1, bot)
	_vp = get_viewport().get_visible_rect().size
	_snow.queue_redraw()


func _draw_snow() -> void:
	var glow := UI.glow()
	var tint := top.lerp(Color.WHITE, 0.35)
	# light shafts from above (twilight zone only)
	if rays > 0.01:
		for i in 5:
			var x := fposmod(i * 310.0 - cam_pos.x * 0.08 + sin(_t * 0.2 + i) * 40.0, _vp.x + 400.0) - 200.0
			var w := 90.0 + 50.0 * sin(i * 2.1)
			var a := (0.045 + 0.02 * sin(_t * 0.6 + i * 1.7)) * rays
			var c0 := Color(0.6, 0.9, 1.0, a)
			var c1 := Color(0.6, 0.9, 1.0, 0.0)
			_snow.draw_polygon(PackedVector2Array([Vector2(x, -20), Vector2(x + w, -20), Vector2(x + w - 380, _vp.y * 0.8), Vector2(x - 380 - w, _vp.y * 0.8)]),
				PackedColorArray([c0, c0, c1, c1]))
	for b: Array in _blobs:
		var bp: Vector2 = b[0]
		var p := Vector2(fposmod(bp.x - cam_pos.x * 0.1, TILE.x), fposmod(bp.y - cam_pos.y * 0.1 - _t * 6.0, TILE.y)) - Vector2(200, 300)
		var s: float = b[1]
		var ba := 0.05 + 0.02 * sin(_t * 0.4 + float(b[2]))
		_snow.draw_texture_rect(glow, Rect2(p - Vector2(s, s), Vector2(s, s) * 2.0), false, Color(tint.r, tint.g, tint.b, ba))
	for m: Array in _motes:
		var mp: Vector2 = m[0]
		var par: float = m[1]
		var p := Vector2(fposmod(mp.x - cam_pos.x * par + sin(_t * 0.5 + float(m[4])) * 18.0, TILE.x), fposmod(mp.y - cam_pos.y * par - _t * 26.0 * par, TILE.y)) - Vector2(200, 300)
		if p.x < -30.0 or p.y < -30.0 or p.x > _vp.x + 30.0 or p.y > _vp.y + 30.0:
			continue
		var s: float = m[2]
		_snow.draw_texture_rect(glow, Rect2(p - Vector2(s, s), Vector2(s, s) * 2.0), false, Color(tint.r, tint.g, tint.b, float(m[3])))
