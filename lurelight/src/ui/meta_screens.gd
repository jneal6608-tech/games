class_name MetaScreens
## Screens for everything between dives: pearl shop, fish, awards, daily reward, and the toast for a new award.

const PEARL := Color("d8ecff")


class FishIcon extends Control:
	## A fish and its lure, drawn from the same art the game uses.
	var id: StringName
	var locked := false
	var _body: Texture2D
	var _tail: Texture2D

	func _init(fish: StringName, px := 190.0) -> void:
		id = fish
		# loaded here, not in _draw: a texture first loaded mid-draw is not uploaded in time for that frame
		_body = load("res://assets/art/fish_body%s.svg" % Meta.FISH[id]["art"])
		_tail = load("res://assets/art/fish_tail%s.svg" % Meta.FISH[id]["art"])
		custom_minimum_size = Vector2(px, px)
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		var d: Dictionary = Meta.FISH[id]
		var s := size.x / 190.0 * 0.62 * float(d["size"])
		var c := size * 0.5 + Vector2(6, 22) * size.x / 190.0
		var col := Color(0.16, 0.2, 0.3) if locked else Color.WHITE
		var body := _body
		var tail := _tail
		draw_set_transform(c + Vector2(-37, 1) * s / 0.4, 0.0, Vector2(s, s))
		draw_texture(tail, Vector2(-116, -80), col)
		draw_set_transform(c, 0.0, Vector2(s, s))
		draw_texture(body, -body.get_size() * 0.5, col)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		# stalk and lure(s)
		var tint: Color = d["tint"]
		if locked:
			tint = Color(0.3, 0.36, 0.5)
		var a := c + Vector2(16, -33) * s / 0.4
		var n := 1 + int(d["twin"])
		for i in n:
			var reach := 62.0 * float(d["len"]) * size.x / 190.0 * (1.0 if i == 0 else 0.7)
			var tip := a + Vector2.from_angle(-1.15 - i * 1.3) * reach
			draw_line(a, tip, Color("c05a9a") if not locked else Color(0.25, 0.3, 0.42), 4.0, true)
			var r := 11.0 * float(d["radius"]) * size.x / 190.0
			draw_circle(tip, r * 2.1, Color(tint.r, tint.g, tint.b, 0.22))
			draw_circle(tip, r, tint)
			draw_circle(tip, r * 0.55, Color(1, 1, 1, 0.9 if not locked else 0.3))


static func _header(v: VBoxContainer, title: String, color: Color) -> Label:
	## Title plus a live pearl count. Returns the pearl label so the screen can refresh it.
	v.add_child(Screens._glow_title(title, 68, color))
	var pl := UI.label("", 36, PEARL, "body_black")
	v.add_child(pl)
	_set_pearls(pl)
	return pl


static func _set_pearls(l: Label) -> void:
	l.text = "%s pearls" % UI.commas(int(Save.data["pearls"]))


static func _card(color: Color, height: float) -> Button:
	var card := Button.new()
	card.focus_mode = Control.FOCUS_NONE
	card.custom_minimum_size = Vector2(0, height)
	var normal := UI.box(UI.PANEL, Color(color.r, color.g, color.b, 0.7), 30, 3)
	var pressed := UI.box(Color(color.r * 0.25, color.g * 0.25, color.b * 0.3, 0.96), color, 30, 4)
	card.add_theme_stylebox_override("normal", normal)
	card.add_theme_stylebox_override("hover", normal)
	card.add_theme_stylebox_override("pressed", pressed)
	card.add_theme_stylebox_override("disabled", normal)
	card.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	return card


static func _card_row(card: Button, sep := 26) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 28
	h.offset_right = -28
	h.offset_top = 14
	h.offset_bottom = -14
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_theme_constant_override("separation", sep)
	card.add_child(h)
	return h


static func _text_col(h: HBoxContainer) -> VBoxContainer:
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tv.alignment = BoxContainer.ALIGNMENT_CENTER
	tv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tv.add_theme_constant_override("separation", 2)
	h.add_child(tv)
	return tv


static func _left(l: Label, wrap := false) -> Label:
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func _done(v: VBoxContainer, on_close: Callable) -> void:
	var done := UI.button("DONE", true, 40)
	done.pressed.connect(on_close)
	v.add_child(done)


# ------------------------------------------------------------------ pearl shop
static func shop(on_close: Callable) -> Control:
	var root := Screens._root(0.97)
	var v := Screens._column(root, BoxContainer.ALIGNMENT_CENTER, 16)
	var pearls := _header(v, "UPGRADES", UI.GOLD)
	v.add_child(Screens._spacer(6))
	var updaters: Array[Callable] = []
	for id: StringName in Meta.UPGRADES:
		var def: Dictionary = Meta.UPGRADES[id]
		var col: Color = def["color"]
		var card := _card(col, 172)
		var h := _card_row(card)
		var tv := _text_col(h)
		tv.add_child(_left(UI.label(String(def["name"]).to_upper(), 32, col, "display")))
		tv.add_child(_left(UI.label(String(def["desc"]), 28, UI.TEXT, "body"), true))
		var pips := _left(UI.label("", 24, UI.DIM, "body_black"))
		tv.add_child(pips)
		var price := UI.label("", 34, PEARL, "display")
		price.custom_minimum_size.x = 170
		price.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		price.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(price)
		var update := func() -> void:
			var lv := Meta.upgrade_level(id)
			var mx := (def["costs"] as Array).size()
			var cost := Meta.upgrade_cost(id)
			pips.text = "LEVEL %d / %d" % [lv, mx]
			if cost < 0:
				price.text = "MAX"
				price.add_theme_color_override("font_color", UI.GOLD)
				card.modulate = Color(1, 1, 1, 0.75)
			else:
				var can := int(Save.data["pearls"]) >= cost
				price.text = UI.commas(cost)
				price.add_theme_color_override("font_color", PEARL if can else Color(0.6, 0.66, 0.8, 0.55))
				card.modulate = Color.WHITE if can else Color(0.78, 0.8, 0.88)
		updaters.append(update)
		card.pressed.connect(func() -> void:
			if Meta.buy_upgrade(id):
				Sfx.play("pick")
				Meta.check_achievements()
				_set_pearls(pearls)
				for u: Callable in updaters:
					u.call()
			else:
				Sfx.play("clink", -8.0))
		v.add_child(card)
	for u: Callable in updaters:
		u.call()
	v.add_child(Screens._spacer(8))
	_done(v, on_close)
	return root


# ------------------------------------------------------------------ fish
static func fish(on_close: Callable, on_unlocked: Callable) -> Control:
	var root := Screens._root(0.97)
	var v := Screens._column(root, BoxContainer.ALIGNMENT_CENTER, 16)
	var pearls := _header(v, "FISH", UI.CYAN)
	v.add_child(Screens._spacer(6))
	var updaters: Array[Callable] = []
	var armed := {}  # fish id -> true once the first "unlock" tap has happened
	for id: StringName in Meta.FISH:
		var def: Dictionary = Meta.FISH[id]
		var col: Color = def["tint"]
		var card := _card(col, 216)
		var h := _card_row(card, 18)
		var icon := FishIcon.new(id, 176.0)
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(icon)
		var tv := _text_col(h)
		tv.add_child(_left(UI.label(String(def["name"]).to_upper(), 36, col, "display")))
		tv.add_child(_left(UI.label(String(def["tag"]), 27, UI.TEXT, "body"), true))
		var state := _left(UI.label("", 26, UI.DIM, "body_black"))
		tv.add_child(state)
		var update := func() -> void:
			var owned := Meta.owns_fish(id)
			icon.locked = not owned
			icon.queue_redraw()
			var hearts := "%d hearts" % int(def["hearts"])
			if Meta.fish_id() == id:
				state.text = "%s   -   SELECTED" % hearts
				state.add_theme_color_override("font_color", UI.GOLD)
				card.modulate = Color.WHITE
			elif owned:
				state.text = "%s   -   tap to select" % hearts
				state.add_theme_color_override("font_color", UI.DIM)
				card.modulate = Color(0.86, 0.88, 0.94)
			else:
				var can := int(Save.data["pearls"]) >= int(def["cost"])
				if armed.has(id):
					state.text = "TAP AGAIN TO UNLOCK"
				else:
					state.text = "%s   -   %s pearls" % [hearts, UI.commas(int(def["cost"]))]
				state.add_theme_color_override("font_color", PEARL if can else Color(0.6, 0.66, 0.8, 0.6))
				card.modulate = Color.WHITE if can else Color(0.78, 0.8, 0.88)
		updaters.append(update)
		card.pressed.connect(func() -> void:
			if Meta.owns_fish(id):
				Meta.select_fish(id)
				Sfx.play("tap")
			elif int(Save.data["pearls"]) < int(def["cost"]):
				Sfx.play("clink", -8.0)
			elif not armed.has(id):
				armed.clear()
				armed[id] = true
				Sfx.play("tap")
			elif Meta.buy_fish(id):
				armed.clear()
				Sfx.play("record")
				on_unlocked.call()
				_set_pearls(pearls)
			for u: Callable in updaters:
				u.call())
		v.add_child(card)
	# lure glows: cosmetic only
	var glow_label := UI.label("", 26, UI.DIM, "body_black")
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 22)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for gid: StringName in Meta.GLOWS:
		var g: Dictionary = Meta.GLOWS[gid]
		var sw := Swatch.new(gid)
		var update := func() -> void:
			sw.queue_redraw()
			if Meta.glow_id() == gid:
				glow_label.text = "LURE GLOW:  %s" % String(g["name"]).to_upper()
		updaters.append(update)
		sw.pressed.connect(func() -> void:
			if Meta.owns_glow(gid):
				Meta.select_glow(gid)
				Sfx.play("tap")
				armed.clear()
			elif int(g["cost"]) < 0:
				glow_label.text = "%s comes with the Starter Pack" % String(g["name"]).to_upper()
				Sfx.play("clink", -8.0)
				return
			elif int(Save.data["pearls"]) < int(g["cost"]):
				glow_label.text = "%s:  %d pearls" % [String(g["name"]).to_upper(), int(g["cost"])]
				Sfx.play("clink", -8.0)
				return
			elif not armed.has(gid):
				armed.clear()
				armed[gid] = true
				Sfx.play("tap")
				for u: Callable in updaters:
					u.call()
				glow_label.text = "%s:  %d pearls  -  TAP AGAIN TO BUY" % [String(g["name"]).to_upper(), int(g["cost"])]
				return
			elif Meta.buy_glow(gid):
				armed.clear()
				Sfx.play("record")
				_set_pearls(pearls)
			for u: Callable in updaters:
				u.call())
		row.add_child(sw)
	v.add_child(row)
	v.add_child(glow_label)
	for u: Callable in updaters:
		u.call()
	_done(v, on_close)
	return root


class Swatch extends Button:
	## A round colour sample for one lure glow.
	var id: StringName

	func _init(glow: StringName) -> void:
		id = glow
		focus_mode = Control.FOCUS_NONE
		flat = true
		custom_minimum_size = Vector2(112, 112)
		for st: String in ["normal", "hover", "pressed", "focus", "disabled"]:
			add_theme_stylebox_override(st, StyleBoxEmpty.new())

	func _draw() -> void:
		var g: Dictionary = Meta.GLOWS[id]
		var c := size * 0.5
		var owned := Meta.owns_glow(id)
		var col: Color = g["color"]
		if id == &"":
			col = Meta.fish_def()["tint"]
		if g.get("rainbow", false):
			for i in 24:
				draw_arc(c, 30.0, TAU * i / 24.0, TAU * (i + 1.1) / 24.0, 6, Color.from_hsv(i / 24.0, 0.55, 1.0, 1.0 if owned else 0.4), 22.0, true)
			draw_circle(c, 14.0, Color(1, 1, 1, 0.9 if owned else 0.3))
		else:
			draw_circle(c, 52.0, Color(col.r, col.g, col.b, 0.16 if owned else 0.06))
			draw_circle(c, 38.0, col if owned else Color(col.r, col.g, col.b, 0.35))
			draw_circle(c, 20.0, Color(1, 1, 1, 0.9 if owned else 0.25))
		if Meta.glow_id() == id:
			draw_arc(c, 53.0, 0, TAU, 48, UI.GOLD, 5.0, true)


# ------------------------------------------------------------------ store
static func store(on_close: Callable) -> Control:
	var root := Screens._root(0.97)
	var v := Screens._column(root, BoxContainer.ALIGNMENT_CENTER, 20)
	v.add_child(Screens._glow_title("STORE", 68, UI.GOLD))
	var pearls := UI.label("", 34, PEARL, "body_black")
	v.add_child(pearls)
	v.add_child(UI.label("Lurelight is free. Everything here is optional.", 28, UI.DIM, "body"))
	var updaters: Array[Callable] = []
	for id: String in Store.PRODUCTS:
		var def: Dictionary = Store.PRODUCTS[id]
		var col: Color = def["color"]
		var pack := Store.consumable(id)
		var card := _card(col, 120 if pack else 176)
		var h := _card_row(card)
		var tv := _text_col(h)
		tv.add_child(_left(UI.label(String(def["title"]).to_upper(), 32, col, "display")))
		if not pack:
			tv.add_child(_left(UI.label(String(def["desc"]), 27, UI.TEXT, "body"), true))
		else:
			tv.add_child(_left(UI.label(String(def["desc"]), 26, UI.DIM, "body_black")))
		var price := UI.label("", 36, UI.TEXT, "display")
		price.custom_minimum_size.x = 200
		price.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		price.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(price)
		var update := func() -> void:
			if Store.owns(id):
				price.text = "OWNED"
				price.add_theme_color_override("font_color", UI.GOLD)
				card.modulate = Color(1, 1, 1, 0.75)
			else:
				price.text = Store.price(id) if Store.price(id) != "" else "..."
		updaters.append(update)
		card.pressed.connect(func() -> void: Store.buy(id))
		v.add_child(card)
	var refresh := func() -> void:
		_set_pearls(pearls)
		for u: Callable in updaters:
			u.call()
	refresh.call()
	Store.changed.connect(refresh)
	root.tree_exiting.connect(func() -> void: Store.changed.disconnect(refresh))
	v.add_child(Screens._spacer(10))
	var restore := UI.button("RESTORE PURCHASES", false, 28)
	restore.custom_minimum_size.y = 92
	restore.pressed.connect(Store.restore)
	v.add_child(restore)
	_done(v, on_close)
	return root


# ------------------------------------------------------------------ awards
static func awards(on_close: Callable) -> Control:
	var root := Screens._root(0.97)
	var v := Screens._column(root, BoxContainer.ALIGNMENT_CENTER, 16)
	var got := 0
	for a: Dictionary in Meta.ACHIEVEMENTS:
		if Meta.has_achievement(a["id"]):
			got += 1
	v.add_child(Screens._glow_title("AWARDS", 68, UI.GOLD))
	v.add_child(UI.label("%d of %d earned" % [got, Meta.ACHIEVEMENTS.size()], 34, UI.DIM, "body_black"))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	v.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 12)
	scroll.add_child(list)
	# earned ones last, so what is left to chase is on top
	var order: Array = Meta.ACHIEVEMENTS.duplicate()
	order.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var da := Meta.has_achievement(a["id"])
		var db := Meta.has_achievement(b["id"])
		if da != db:
			return not da
		return Meta.ACHIEVEMENTS.find(a) < Meta.ACHIEVEMENTS.find(b))
	for a: Dictionary in order:
		var done := Meta.has_achievement(a["id"])
		var panel := PanelContainer.new()
		panel.mouse_filter = Control.MOUSE_FILTER_PASS
		panel.add_theme_stylebox_override("panel", UI.box(Color(0.16, 0.13, 0.04, 0.9) if done else UI.PANEL,
			Color(1.0, 0.85, 0.42, 0.7) if done else Color(0.42, 0.91, 1.0, 0.25), 26, 3))
		var h := HBoxContainer.new()
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_theme_constant_override("separation", 18)
		panel.add_child(h)
		var tv := _text_col(h)
		tv.add_child(_left(UI.label(String(a["name"]).to_upper(), 28, UI.GOLD if done else UI.TEXT, "display")))
		tv.add_child(_left(UI.label(String(a["desc"]), 26, UI.DIM, "body"), true))
		var right := UI.label("", 26, UI.GOLD if done else PEARL, "body_black")
		right.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		right.custom_minimum_size.x = 190
		if done:
			right.text = "EARNED"
		else:
			right.text = "%s / %s\n+%d pearls" % [UI.commas(mini(Meta.stat(a["stat"]), int(a["need"]))), UI.commas(int(a["need"])), int(a["reward"])]
		h.add_child(right)
		list.add_child(panel)
	_done(v, on_close)
	return root


# ------------------------------------------------------------------ daily reward
static func daily_reward(on_claim: Callable, on_double: Callable = Callable()) -> Control:
	## on_claim(multiplier). on_double is set when a rewarded ad can double the reward.
	var root := Screens._root(0.9)
	var v := Screens._column(root, BoxContainer.ALIGNMENT_CENTER, 22)
	var day := Meta.reward_day()
	v.add_child(Screens._glow_title("DAILY REWARD", 64, UI.GOLD))
	v.add_child(UI.label("Come back every day. Miss one and the week starts over.", 30, UI.DIM, "body"))
	v.add_child(Screens._spacer(10))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(grid)
	for i in Meta.DAILY_REWARDS.size():
		var panel := PanelContainer.new()
		panel.custom_minimum_size = Vector2(206, 170)
		panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var today := i == day
		panel.add_theme_stylebox_override("panel", UI.box(Color(0.2, 0.16, 0.04, 0.95) if today else UI.PANEL,
			UI.GOLD if today else Color(0.42, 0.91, 1.0, 0.25), 26, 4 if today else 3))
		if i < day:
			panel.modulate = Color(1, 1, 1, 0.4)
		var cv := VBoxContainer.new()
		cv.alignment = BoxContainer.ALIGNMENT_CENTER
		cv.mouse_filter = Control.MOUSE_FILTER_IGNORE
		panel.add_child(cv)
		cv.add_child(UI.label("DAY %d" % (i + 1), 24, UI.GOLD if today else UI.DIM, "body_black"))
		cv.add_child(UI.label("+%d" % Meta.DAILY_REWARDS[i], 44, PEARL, "display"))
		cv.add_child(UI.label("claimed" if i < day else "pearls", 22, UI.DIM, "body"))
		grid.add_child(panel)
	v.add_child(Screens._spacer(16))
	var claim := UI.button("CLAIM  +%d" % Meta.DAILY_REWARDS[day], true, 44)
	claim.pressed.connect(func() -> void: on_claim.call(1))
	v.add_child(claim)
	var buttons: Array = [claim]
	if on_double.is_valid():
		var dbl := UI.button("WATCH AD: CLAIM  +%d" % (Meta.DAILY_REWARDS[day] * 2), false, 30)
		dbl.pressed.connect(on_double)
		v.add_child(dbl)
		buttons.append(dbl)
	Screens._arm(root, buttons, 0.5)
	return root


# ------------------------------------------------------------------ toast
static func toast(title: String, sub: String) -> Control:
	## Slides in under the top edge, waits, slides away and frees itself.
	var holder := Control.new()
	holder.set_anchors_preset(Control.PRESET_TOP_WIDE)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", UI.box(Color(0.14, 0.11, 0.03, 0.96), UI.GOLD, 30, 4))
	panel.set_anchors_preset(Control.PRESET_TOP_WIDE)
	panel.offset_left = 70
	panel.offset_right = -70
	holder.add_child(panel)
	var cv := VBoxContainer.new()
	cv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cv.add_theme_constant_override("separation", 0)
	panel.add_child(cv)
	cv.add_child(UI.label(title, 32, UI.GOLD, "display"))
	cv.add_child(UI.label(sub, 28, UI.TEXT, "body_black"))
	holder.ready.connect(func() -> void:
		var top := UI.safe_top(holder.get_viewport()) + 30.0
		panel.position.y = -220.0
		var tw := holder.create_tween()
		tw.tween_property(panel, "position:y", top, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_interval(2.3)
		tw.tween_property(panel, "position:y", -220.0, 0.3)
		tw.tween_callback(holder.queue_free))
	return holder
