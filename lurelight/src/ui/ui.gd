class_name UI
## Shared look: colours, fonts, panels, buttons.

const GOLD := Color("ffd86b")
const GOLD_HOT := Color("fff3c4")
const CYAN := Color("6be8ff")
const MINT := Color("7cffcb")
const PINK := Color("ff6fd8")
const RED := Color("ff5470")
const INK := Color("040a16")
const PANEL := Color(0.035, 0.075, 0.16, 0.94)
const TEXT := Color("eef6ff")
const DIM := Color(0.74, 0.84, 1.0, 0.62)

static var _fonts := {}
static var _glow: Texture2D
static var _add_mat: CanvasItemMaterial


static func font(kind := "body") -> Font:
	if _fonts.is_empty():
		_fonts["display"] = load("res://assets/fonts/unbounded-latin-700-normal.woff2")
		_fonts["black"] = load("res://assets/fonts/unbounded-latin-900-normal.woff2")
		_fonts["body"] = load("res://assets/fonts/nunito-latin-700-normal.woff2")
		_fonts["body_black"] = load("res://assets/fonts/nunito-latin-900-normal.woff2")
	return _fonts[kind]


static func glow() -> Texture2D:
	if _glow == null:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.18, 0.45, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.62), Color(1, 1, 1, 0.16), Color(1, 1, 1, 0)])
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = 128
		t.height = 128
		_glow = t
	return _glow


static func additive() -> CanvasItemMaterial:
	if _add_mat == null:
		_add_mat = CanvasItemMaterial.new()
		_add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return _add_mat


static func label(text: String, size: int, color := TEXT, kind := "body") -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font(kind))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


static func box(bg: Color, border: Color, radius := 28, border_w := 3) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(border_w)
	s.set_corner_radius_all(radius)
	s.anti_aliasing = true
	s.content_margin_left = 28
	s.content_margin_right = 28
	s.content_margin_top = 18
	s.content_margin_bottom = 18
	return s


static func button(text: String, primary := true, size := 40) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_override("font", font("display"))
	b.add_theme_font_size_override("font_size", size)
	var fg := INK if primary else TEXT
	for c: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, fg)
	var normal: StyleBoxFlat
	var pressed: StyleBoxFlat
	if primary:
		normal = box(GOLD, GOLD_HOT, 36, 4)
		normal.shadow_color = Color(1.0, 0.82, 0.3, 0.35)
		normal.shadow_size = 26
		pressed = box(Color("e8b84a"), GOLD, 36, 4)
	else:
		normal = box(Color(0.1, 0.18, 0.34, 0.9), Color(0.42, 0.91, 1.0, 0.55), 36, 3)
		pressed = box(Color(0.07, 0.12, 0.24, 0.95), CYAN, 36, 3)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", normal)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.custom_minimum_size = Vector2(0, 124 if primary else 104)
	b.pressed.connect(func() -> void: Sfx.play("tap"))
	return b


static func commas(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out


static func safe_top(vp: Viewport) -> float:
	## Top inset (notch / camera cut-out) in canvas units.
	var win := DisplayServer.window_get_size()
	if win.y <= 0:
		return 0.0
	var safe := DisplayServer.get_display_safe_area()
	var scale := vp.get_visible_rect().size.y / float(win.y)
	return clampf(float(safe.position.y) * scale, 0.0, 160.0)
