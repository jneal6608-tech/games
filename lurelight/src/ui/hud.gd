class_name Hud extends CanvasLayer
## In-run overlay: hearts, plankton bar, depth, combo, boss bar, banners, screen flash, joystick ghost.
## In clip mode everything persistent is hidden so screen recordings are clean.

signal pause_pressed

const JOY_R := 130.0

var world: World
var joy_active := false
var joy_anchor := Vector2.ZERO
var joy_vec := Vector2.ZERO
var hint := ""

var _root: Control
var _canvas: Control
var _pause: Button
var _flash: ColorRect
var _banner: Control
var _banner_title: Label
var _banner_sub: Label
var _hint: Label
var _heart: Texture2D
var _pearl: Texture2D
var _combo_punch := 0.0
var _last_combo := 0
var _hurt_show := 0.0
var _boss: Enemy
var _boss_show := 0.0
var _depth_shown := 200.0
var _banner_tween: Tween


func _ready() -> void:
	layer = 10
	_heart = load("res://assets/art/heart.svg")
	_pearl = load("res://assets/art/pearl.svg")
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	# vignette
	var vg := Gradient.new()
	vg.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	vg.colors = PackedColorArray([Color(0, 0, 0, 0), Color(0, 0, 0.02, 0.0), Color(0, 0, 0.03, 0.62)])
	var vt := GradientTexture2D.new()
	vt.gradient = vg
	vt.fill = GradientTexture2D.FILL_RADIAL
	vt.fill_from = Vector2(0.5, 0.5)
	vt.fill_to = Vector2(1.05, 1.05)
	vt.width = 128
	vt.height = 128
	var vr := TextureRect.new()
	vr.texture = vt
	vr.stretch_mode = TextureRect.STRETCH_SCALE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT)
	vr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(vr)

	_flash = ColorRect.new()
	_flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_flash.color = Color(1, 1, 1, 0)
	_root.add_child(_flash)

	_canvas = Control.new()
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_hud)
	_root.add_child(_canvas)

	_banner = Control.new()
	_banner.set_anchors_preset(Control.PRESET_FULL_RECT)
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.modulate.a = 0.0
	_root.add_child(_banner)
	_banner_title = UI.label("", 76, UI.CYAN, "black")
	_banner_title.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_banner_title.add_theme_constant_override("outline_size", 14)
	_banner_title.add_theme_color_override("font_outline_color", Color(0.01, 0.03, 0.08, 0.8))
	_banner.add_child(_banner_title)
	_banner_sub = UI.label("", 44, UI.TEXT, "display")
	_banner_sub.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_banner_sub.add_theme_constant_override("outline_size", 10)
	_banner_sub.add_theme_color_override("font_outline_color", Color(0.01, 0.03, 0.08, 0.8))
	_banner.add_child(_banner_sub)

	_hint = UI.label("", 46, UI.TEXT, "body_black")
	_hint.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_hint.add_theme_constant_override("outline_size", 12)
	_hint.add_theme_color_override("font_outline_color", Color(0.01, 0.03, 0.08, 0.85))
	_hint.modulate.a = 0.0
	_root.add_child(_hint)

	_pause = Button.new()
	_pause.focus_mode = Control.FOCUS_NONE
	_pause.flat = true
	_pause.custom_minimum_size = Vector2(110, 110)
	_pause.size = Vector2(110, 110)
	for st: String in ["normal", "hover", "pressed", "focus"]:
		_pause.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	_pause.pressed.connect(func() -> void:
		Sfx.play("tap")
		pause_pressed.emit())
	_root.add_child(_pause)


func bind(w: World) -> void:
	world = w
	_boss = null
	_boss_show = 0.0
	_last_combo = 0
	_depth_shown = 200.0
	if w == null:
		return
	w.banner.connect(show_banner)
	w.flashed.connect(flash)
	w.boss_changed.connect(func(b: Enemy) -> void: _boss = b)
	w.hearts_changed.connect(func() -> void: _hurt_show = 2.0)


func flash(color: Color, strength: float) -> void:
	_flash.color = Color(color.r, color.g, color.b, strength)
	create_tween().tween_property(_flash, "color:a", 0.0, 0.45).set_ease(Tween.EASE_OUT)


func show_banner(title: String, sub: String, color: Color) -> void:
	var h := _root.size.y
	_banner_title.text = title
	_banner_title.add_theme_color_override("font_color", color)
	_banner_title.position.y = h * 0.24
	_banner_sub.text = sub
	_banner_sub.position.y = h * 0.24 + 104.0
	if _banner_tween != null:
		_banner_tween.kill()
	_banner.modulate.a = 0.0
	_banner.position.y = 40.0
	_banner_tween = create_tween()
	_banner_tween.set_parallel(true)
	_banner_tween.tween_property(_banner, "modulate:a", 1.0, 0.25)
	_banner_tween.tween_property(_banner, "position:y", 0.0, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_banner_tween.chain().tween_interval(1.7)
	_banner_tween.chain().tween_property(_banner, "modulate:a", 0.0, 0.5)


func hide_banner() -> void:
	if _banner_tween != null:
		_banner_tween.kill()
	_banner.modulate.a = 0.0


func _process(delta: float) -> void:
	var clip := bool(Save.data["clip_mode"])
	var active := world != null and not world.attract
	_pause.visible = active and not clip and world.running
	var top := UI.safe_top(get_viewport())
	_pause.position = Vector2(_root.size.x - 36.0 - 110.0, top + 64.0)
	if active:
		if world.combo > _last_combo:
			_combo_punch = 1.0
		_last_combo = world.combo
		_combo_punch = maxf(0.0, _combo_punch - delta * 5.0)
		_hurt_show = maxf(0.0, _hurt_show - delta)
		_boss_show = move_toward(_boss_show, 1.0 if _boss != null and is_instance_valid(_boss) else 0.0, delta * 3.0)
		_depth_shown = lerpf(_depth_shown, world.depth, minf(1.0, delta * 6.0))
	# tutorial hint
	_hint.text = hint
	_hint.position.y = _root.size.y * 0.68
	_hint.modulate.a = move_toward(_hint.modulate.a, 1.0 if hint != "" and active and world.running else 0.0, delta * 3.0)
	_canvas.queue_redraw()


func _draw_hud() -> void:
	if world == null or world.attract:
		return
	var c := _canvas
	var w := _root.size.x
	var h := _root.size.y
	var clip := bool(Save.data["clip_mode"])
	var top := UI.safe_top(get_viewport())
	var display := UI.font("black")
	var body := UI.font("body_black")

	# joystick ghost
	if joy_active and not clip and world.running:
		c.draw_arc(joy_anchor, JOY_R, 0, TAU, 48, Color(1, 1, 1, 0.14), 4.0, true)
		c.draw_circle(joy_anchor + joy_vec * JOY_R, 46.0, Color(1, 1, 1, 0.16))

	if clip:
		# only a brief heart read-out near the fish after taking or healing damage
		if _hurt_show > 0.0:
			var a := clampf(_hurt_show, 0.0, 1.0)
			var n := world.max_hearts
			var x0 := w * 0.5 - (n * 46.0) * 0.5
			for i in n:
				var col := Color(1, 1, 1, a) if i < world.hearts else Color(0.25, 0.3, 0.45, a * 0.7)
				c.draw_texture_rect(_heart, Rect2(x0 + i * 46.0, h * 0.5 + 90.0, 40, 40), false, col)
		return

	# plankton (xp) bar
	var bx := 36.0
	var by := top + 24.0
	var bw := w - 72.0
	var bh := 18.0
	_bar(c, Rect2(bx, by, bw, bh), Color(0.03, 0.08, 0.18, 0.8))
	var k := clampf(world.xp / world.xp_need, 0.0, 1.0)
	if k > 0.01:
		_bar(c, Rect2(bx, by, maxf(bh, bw * k), bh), UI.MINT.lerp(UI.GOLD, k * k))
	_text(c, body, Vector2(bx + 6.0, by + 54.0), "LV %d" % world.level, 30, UI.MINT, HORIZONTAL_ALIGNMENT_LEFT)

	# hearts
	var hy := top + 100.0
	var hs := 54.0 if world.max_hearts <= 5 else 42.0  # shrink so a long row never reaches the depth read-out
	for i in world.max_hearts:
		var col := Color.WHITE if i < world.hearts else Color(0.22, 0.27, 0.42, 0.8)
		var s := hs
		if i == world.hearts - 1 and world.hearts == 1:
			s += sin(world.real_t * 9.0) * 5.0
		c.draw_texture_rect(_heart, Rect2(bx + i * (hs + 3.0) + (hs - s) * 0.5, hy + (54.0 - s) * 0.5, s, s), false, col)
	# pearls this run
	c.draw_texture_rect(_pearl, Rect2(bx - 4.0, hy + 62.0, 48, 48), false)
	_text(c, body, Vector2(bx + 48.0, hy + 98.0), str(world.pearls_run), 32, Color("d8ecff"), HORIZONTAL_ALIGNMENT_LEFT)

	# depth
	_text(c, display, Vector2(w * 0.5, top + 126.0), "%s m" % UI.commas(int(_depth_shown)), 58, UI.TEXT)
	_text(c, body, Vector2(w * 0.5, top + 164.0), String(world.zone_def(world.zone)["name"]), 26, UI.DIM)

	# pause glyph
	if world.running:
		var pp := Vector2(w - 36.0 - 55.0, top + 64.0 + 55.0)
		c.draw_circle(pp, 44.0, Color(0.05, 0.1, 0.2, 0.55))
		c.draw_arc(pp, 44.0, 0, TAU, 40, Color(1, 1, 1, 0.25), 2.5, true)
		c.draw_rect(Rect2(pp + Vector2(-16, -17), Vector2(11, 34)), Color(1, 1, 1, 0.85))
		c.draw_rect(Rect2(pp + Vector2(5, -17), Vector2(11, 34)), Color(1, 1, 1, 0.85))

	# boss bar
	if _boss_show > 0.01 and _boss != null and is_instance_valid(_boss):
		var a := _boss_show
		var y := top + 214.0
		var ww := w - 220.0
		_text(c, display, Vector2(w * 0.5, y), _boss.title, 30, Color(1, 0.55, 0.6, a))
		_bar(c, Rect2(110.0, y + 14.0, ww, 22.0), Color(0.12, 0.02, 0.06, 0.8 * a))
		var hk := clampf(_boss.hp / _boss.max_hp, 0.0, 1.0)
		if hk > 0.0:
			_bar(c, Rect2(110.0, y + 14.0, maxf(22.0, ww * hk), 22.0), Color(1.0, 0.33, 0.44, a))

	# combo
	if world.combo >= 3:
		var sc := 1.0 + _combo_punch * 0.35  # scale, not font size (see Items)
		var col := UI.GOLD.lerp(Color.WHITE, _combo_punch)
		var cy := top + 330.0
		c.draw_set_transform(Vector2(w - 60.0, cy), 0.0, Vector2(sc, sc))
		_text(c, display, Vector2.ZERO, "x%d" % world.combo, 72, col, HORIZONTAL_ALIGNMENT_RIGHT)
		c.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		var ck := clampf(world.combo_t / World.COMBO_WINDOW, 0.0, 1.0)
		_bar(c, Rect2(w - 60.0 - 170.0 * ck, cy + 16.0, 170.0 * ck, 8.0), Color(1, 0.85, 0.42, 0.8))


func _bar(c: Control, r: Rect2, col: Color) -> void:
	var rad := r.size.y * 0.5
	if r.size.x <= r.size.y:
		c.draw_circle(r.position + Vector2(rad, rad), rad, col)
		return
	c.draw_rect(Rect2(r.position + Vector2(rad, 0), r.size - Vector2(rad * 2.0, 0)), col)
	c.draw_circle(r.position + Vector2(rad, rad), rad, col)
	c.draw_circle(r.position + Vector2(r.size.x - rad, rad), rad, col)


func _text(c: Control, font: Font, pos: Vector2, s: String, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_CENTER) -> void:
	var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var p := pos
	if align == HORIZONTAL_ALIGNMENT_CENTER:
		p.x -= w * 0.5
	elif align == HORIZONTAL_ALIGNMENT_RIGHT:
		p.x -= w
	c.draw_string_outline(font, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 8, Color(0.01, 0.03, 0.08, 0.7 * col.a))
	c.draw_string(font, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)
