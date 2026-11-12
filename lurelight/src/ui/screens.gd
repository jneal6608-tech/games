class_name Screens
## Builders for every full-screen overlay. Each returns a Control that Main adds above the HUD.

const SIDE := 96
## Where the privacy policy is hosted. Settings shows a PRIVACY POLICY button once this is filled in
## (store/PUBLISHING.md explains how to host store/privacy-policy.html for free).
const PRIVACY_URL := ""


static func _root(dim := 0.0) -> Control:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	if dim > 0.0:
		var bgc := ColorRect.new()
		bgc.color = Color(0.008, 0.02, 0.05, dim)
		bgc.set_anchors_preset(Control.PRESET_FULL_RECT)
		bgc.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(bgc)
	root.modulate.a = 0.0
	root.ready.connect(func() -> void: root.create_tween().tween_property(root, "modulate:a", 1.0, 0.22))
	return root


static func _column(root: Control, align := BoxContainer.ALIGNMENT_CENTER, sep := 26) -> VBoxContainer:
	var m := MarginContainer.new()
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_theme_constant_override("margin_left", SIDE)
	m.add_theme_constant_override("margin_right", SIDE)
	m.add_theme_constant_override("margin_top", 150)
	m.add_theme_constant_override("margin_bottom", 130)
	root.add_child(m)
	var v := VBoxContainer.new()
	v.alignment = align
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", sep)
	m.add_child(v)
	return v


static func _spacer(h: float, expand := false) -> Control:
	var s := Control.new()
	s.custom_minimum_size = Vector2(0, h)
	s.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if expand:
		s.size_flags_vertical = Control.SIZE_EXPAND_FILL
	return s


static func _arm(root: Control, buttons: Array, delay: float) -> void:
	## Ignore taps for a moment so a thumb that was steering cannot press something by accident.
	for b: Button in buttons:
		b.disabled = true
		b.add_theme_stylebox_override("disabled", b.get_theme_stylebox("normal"))
		for c: String in ["font_disabled_color"]:
			b.add_theme_color_override(c, b.get_theme_color("font_color"))
	root.ready.connect(func() -> void:
		await root.get_tree().create_timer(delay).timeout
		for b: Variant in buttons:  # untyped: a button may have been freed while we waited
			if is_instance_valid(b):
				(b as Button).disabled = false)


static func _glow_title(text: String, size: int, color: Color) -> Label:
	var l := UI.label(text, size, color, "black")
	l.add_theme_constant_override("outline_size", 18)
	l.add_theme_color_override("font_outline_color", Color(color.r, color.g, color.b, 0.16))
	l.add_theme_color_override("font_shadow_color", Color(color.r, color.g * 0.7, color.b * 0.3, 0.35))
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", 6)
	l.add_theme_constant_override("shadow_outline_size", 30)
	return l


# ------------------------------------------------------------------ main menu
static func menu(on: Dictionary, cut_off := 0) -> Control:
	## on: play, daily, settings, fish, shop, awards (Callables)
	var root := _root()
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var v := _column(root, BoxContainer.ALIGNMENT_BEGIN, 22)
	v.add_child(_spacer(90))
	v.add_child(_glow_title("LURELIGHT", 112, UI.GOLD))
	v.add_child(UI.label("Swing the light. Survive the deep.", 40, UI.DIM, "body"))
	v.add_child(_spacer(0, true))
	if cut_off > 0:
		var note := UI.label("Your last dive was cut off at %s m.\nIt still counts toward your best." % UI.commas(cut_off), 30, UI.GOLD, "body_black")
		note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(note)
	var best := int(Save.data["best_depth"])
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 60)
	row.add_child(_stat("BEST DIVE", "%s m" % UI.commas(best) if best > 0 else "-", UI.CYAN))
	row.add_child(_stat("PEARLS", UI.commas(int(Save.data["pearls"])), Color("d8ecff")))
	v.add_child(row)
	v.add_child(_spacer(20))
	var play := UI.button("DIVE", true, 52)
	play.custom_minimum_size.y = 150
	play.pressed.connect(on["play"])
	v.add_child(play)
	var db := Save.daily_best()
	var daily := UI.button("DAILY DIVE" + ("   %s m" % UI.commas(db) if db > 0 else ""), false, 34)
	daily.pressed.connect(on["daily"])
	v.add_child(daily)
	var streak := Meta.daily_streak_alive()
	if streak > 0:
		var kept := int(Save.data["daily_last"]) == Save.day_index()
		v.add_child(UI.label("Daily streak: %d day%s%s" % [streak, "" if streak == 1 else "s", "" if kept else "  -  dive today to keep it"],
			28, UI.GOLD if not kept else UI.DIM, "body_black"))
	var trio := HBoxContainer.new()
	trio.add_theme_constant_override("separation", 16)
	trio.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(trio)
	for item: Array in [["FISH", "fish", Meta.can_unlock_fish()], ["UPGRADES", "shop", Meta.can_buy_something()], ["AWARDS", "awards", false]]:
		var b := UI.button(item[0], false, 25)
		b.custom_minimum_size.y = 100
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if item[2]:
			# something here is affordable right now
			for c: String in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, UI.GOLD)
		b.pressed.connect(on[item[1]])
		trio.add_child(b)
	var last := HBoxContainer.new()
	last.add_theme_constant_override("separation", 16)
	last.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(last)
	if Store.available():
		var shop := UI.button("STORE", false, 26)
		shop.custom_minimum_size.y = 88
		shop.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		shop.pressed.connect(on["store"])
		last.add_child(shop)
	var settings := UI.button("SETTINGS", false, 26)
	settings.custom_minimum_size.y = 88
	settings.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	settings.pressed.connect(on["settings"])
	last.add_child(settings)
	# gentle breathing on the main button
	root.ready.connect(func() -> void:
		var tw := play.create_tween().set_loops()
		tw.tween_property(play, "modulate", Color(1.12, 1.12, 1.12), 0.9).set_trans(Tween.TRANS_SINE)
		tw.tween_property(play, "modulate", Color.WHITE, 0.9).set_trans(Tween.TRANS_SINE))
	return root


static func _stat(title: String, value: String, color: Color) -> VBoxContainer:
	var b := VBoxContainer.new()
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_theme_constant_override("separation", 0)
	b.add_child(UI.label(title, 26, UI.DIM, "body_black"))
	b.add_child(UI.label(value, 44, color, "display"))
	return b


# ------------------------------------------------------------------ level-up
static func level_up(world: World, choices: Array, on_pick: Callable, reroll_text := "", on_reroll: Callable = Callable()) -> Control:
	var root := _root(0.62)
	var v := _column(root, BoxContainer.ALIGNMENT_CENTER, 28)
	v.add_child(_glow_title("MUTATE", 84, UI.GOLD))
	v.add_child(UI.label("Level %d  -  choose one" % world.level, 36, UI.DIM, "body"))
	v.add_child(_spacer(10))
	var cards: Array = []
	for id: StringName in choices:
		var info := Mutations.info(id)
		var lv := int(world.muts.get(id, 0))
		var col: Color = info["color"]
		var card := Button.new()
		card.focus_mode = Control.FOCUS_NONE
		card.custom_minimum_size = Vector2(0, 236)
		var normal := UI.box(UI.PANEL, Color(col.r, col.g, col.b, 0.85), 34, 4)
		normal.shadow_color = Color(col.r, col.g, col.b, 0.22)
		normal.shadow_size = 22
		var pressed := UI.box(Color(col.r * 0.25, col.g * 0.25, col.b * 0.3, 0.96), col, 34, 5)
		card.add_theme_stylebox_override("normal", normal)
		card.add_theme_stylebox_override("hover", normal)
		card.add_theme_stylebox_override("pressed", pressed)
		card.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		var h := HBoxContainer.new()
		h.set_anchors_preset(Control.PRESET_FULL_RECT)
		h.offset_left = 34
		h.offset_right = -34
		h.offset_top = 20
		h.offset_bottom = -20
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_theme_constant_override("separation", 34)
		card.add_child(h)
		var icon := MutIcon.new(id, 150.0)
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(icon)
		var tv := VBoxContainer.new()
		tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tv.alignment = BoxContainer.ALIGNMENT_CENTER
		tv.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tv.add_theme_constant_override("separation", 6)
		h.add_child(tv)
		var name_l := UI.label(String(info["name"]).to_upper(), 40, col, "display")
		name_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		tv.add_child(name_l)
		var desc := UI.label(String(info["desc"]), 33, UI.TEXT, "body")
		desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		tv.add_child(desc)
		var mx := int(info["max"])
		if mx < 50:
			var tag := UI.label("NEW" if lv == 0 else "LEVEL %d  >  %d" % [lv, lv + 1], 26, UI.GOLD if lv == 0 else UI.DIM, "body_black")
			tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
			tv.add_child(tag)
		card.pressed.connect(func() -> void: on_pick.call(id))
		v.add_child(card)
		cards.append(card)
	if reroll_text != "":
		var rr := UI.button(reroll_text, false, 28)
		rr.custom_minimum_size.y = 92
		rr.pressed.connect(on_reroll)
		v.add_child(rr)
		_arm(root, [rr], 0.45)
	_arm(root, cards, 0.45)
	# stagger the cards in
	root.ready.connect(func() -> void:
		for i in cards.size():
			var c: Button = cards[i]
			c.modulate.a = 0.0
			var tw := c.create_tween()
			tw.tween_interval(0.08 * i)
			tw.tween_property(c, "modulate:a", 1.0, 0.2))
	return root


# ------------------------------------------------------------------ end of run
static func end_card(stats: Dictionary, result: Dictionary, daily: bool, on_again: Callable, on_home: Callable, on_double: Callable = Callable()) -> Control:
	## result comes from Meta.finish_run. on_double(done) is valid when a rewarded ad can double the pearls;
	## it must call done.call() once the pearls have been doubled.
	var new_best: bool = result["new_best"]
	var root := _root(0.74)
	var v := _column(root, BoxContainer.ALIGNMENT_CENTER, 16)
	v.add_child(UI.label("DAILY DIVE" if daily else "DIVE OVER", 40, UI.DIM, "display"))
	var depth_l := _glow_title("0 m", 120, UI.GOLD if new_best else UI.CYAN)
	v.add_child(depth_l)
	v.add_child(UI.label(String(stats["zone"]), 34, UI.DIM, "body_black"))
	if new_best:
		var nb := UI.label("NEW BEST!", 46, UI.GOLD, "black")
		v.add_child(nb)
		root.ready.connect(func() -> void:
			var tw := nb.create_tween().set_loops()
			tw.tween_property(nb, "modulate:a", 0.45, 0.45)
			tw.tween_property(nb, "modulate:a", 1.0, 0.45))
	else:
		v.add_child(UI.label("Best  %s m" % UI.commas(int(Save.data["best_depth"])), 32, UI.DIM, "body"))
	v.add_child(_spacer(16))
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UI.box(UI.PANEL, Color(0.42, 0.91, 1.0, 0.3), 34, 3))
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(panel)
	var pv := VBoxContainer.new()
	pv.add_theme_constant_override("separation", 18)
	pv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(pv)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 56)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pv.add_child(row)
	var secs := int(float(stats["time"]))
	row.add_child(_stat("EATEN", UI.commas(int(stats["kills"])), UI.TEXT))
	row.add_child(_stat("COMBO", "x%d" % int(stats["combo"]), UI.GOLD))
	row.add_child(_stat("TIME", "%d:%02d" % [secs / 60, secs % 60], UI.TEXT))
	var pearl_stat := _stat("PEARLS", "+%d" % int(result["earned"]), Color("d8ecff"))
	row.add_child(pearl_stat)
	var extras := "Depth bonus +%d" % int(result["depth_bonus"])
	if int(result["daily_bonus"]) > 0:
		extras += "     Daily streak x%d  +%d" % [int(result["daily_streak"]), int(result["daily_bonus"])]
	pv.add_child(UI.label(extras, 26, UI.DIM, "body_black"))
	var muts: Dictionary = stats["muts"]
	if not muts.is_empty():
		var flow := HFlowContainer.new()
		flow.alignment = FlowContainer.ALIGNMENT_CENTER
		flow.add_theme_constant_override("h_separation", 14)
		flow.add_theme_constant_override("v_separation", 10)
		flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
		pv.add_child(flow)
		for id: StringName in muts:
			var cell := VBoxContainer.new()
			cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
			cell.add_theme_constant_override("separation", 0)
			cell.add_child(MutIcon.new(id, 84.0))
			cell.add_child(UI.label("Lv %d" % int(muts[id]), 22, UI.DIM, "body_black"))
			flow.add_child(cell)
	v.add_child(_spacer(8))
	var armed: Array = []
	if on_double.is_valid() and int(result["earned"]) > 0:
		var dbl := UI.button("WATCH AD: DOUBLE PEARLS", false, 28)
		dbl.custom_minimum_size.y = 96
		dbl.pressed.connect(func() -> void:
			on_double.call(func() -> void:
				dbl.disabled = true
				dbl.text = "PEARLS DOUBLED!"
				(pearl_stat.get_child(1) as Label).text = "+%d" % (int(result["earned"]) * 2)))
		v.add_child(dbl)
		armed.append(dbl)
	var again := UI.button("DIVE AGAIN", true, 46)
	again.custom_minimum_size.y = 140
	again.pressed.connect(on_again)
	v.add_child(again)
	var home := UI.button("HOME", false, 32)
	home.pressed.connect(on_home)
	v.add_child(home)
	armed.append(again)
	armed.append(home)
	_arm(root, armed, 0.7)
	# count the depth up
	var target := int(stats["depth"])
	root.ready.connect(func() -> void:
		var tw := root.create_tween()
		tw.tween_method(func(val: float) -> void: depth_l.text = "%s m" % UI.commas(int(val)), 0.0, float(target), 0.9).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC))
	return root


# ------------------------------------------------------------------ revive offer
static func revive(depth: int, on_watch: Callable, on_skip: Callable, seconds := 6.0) -> Control:
	var root := _root(0.7)
	var v := _column(root, BoxContainer.ALIGNMENT_CENTER, 24)
	v.add_child(_glow_title("NOT YET?", 84, UI.GOLD))
	v.add_child(UI.label("%s m  -  one second chance per dive" % UI.commas(depth), 34, UI.DIM, "body_black"))
	v.add_child(_spacer(20))
	var watch := UI.button("WATCH AD: REVIVE", true, 42)
	watch.custom_minimum_size.y = 150
	watch.pressed.connect(on_watch)
	v.add_child(watch)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size.y = 14
	bar.max_value = 1.0
	bar.value = 1.0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("background", UI.box(Color(0.05, 0.1, 0.2, 0.8), Color.TRANSPARENT, 7, 0))
	bar.add_theme_stylebox_override("fill", UI.box(UI.GOLD, Color.TRANSPARENT, 7, 0))
	v.add_child(bar)
	var skip := UI.button("NO THANKS", false, 30)
	skip.pressed.connect(on_skip)
	v.add_child(skip)
	_arm(root, [watch, skip], 0.6)
	root.ready.connect(func() -> void:
		var tw := root.create_tween()
		tw.tween_property(bar, "value", 0.0, seconds)
		tw.tween_callback(on_skip)
		# stop counting once a button has been pressed (the ad may take a while to appear)
		watch.pressed.connect(tw.kill)
		skip.pressed.connect(tw.kill))
	return root


# ------------------------------------------------------------------ pause
static func pause(on_resume: Callable, on_restart: Callable, on_home: Callable, on_settings: Callable) -> Control:
	var root := _root(0.72)
	var v := _column(root, BoxContainer.ALIGNMENT_CENTER, 26)
	v.add_child(_glow_title("PAUSED", 84, UI.CYAN))
	v.add_child(_spacer(30))
	var resume := UI.button("RESUME", true, 46)
	resume.pressed.connect(on_resume)
	v.add_child(resume)
	var restart := UI.button("RESTART", false, 32)
	restart.pressed.connect(on_restart)
	v.add_child(restart)
	var settings := UI.button("SETTINGS", false, 32)
	settings.pressed.connect(on_settings)
	v.add_child(settings)
	var home := UI.button("QUIT DIVE", false, 32)
	home.pressed.connect(on_home)
	v.add_child(home)
	return root


# ------------------------------------------------------------------ settings
static func settings(on_close: Callable) -> Control:
	var root := _root(0.97)
	var v := _column(root, BoxContainer.ALIGNMENT_CENTER, 22)
	v.add_child(_glow_title("SETTINGS", 72, UI.CYAN))
	v.add_child(_spacer(24))
	for item: Array in [["music", "MUSIC"], ["sfx", "SOUND"], ["haptics", "VIBRATION"], ["clip_mode", "CLIP MODE"]]:
		var key: String = item[0]
		var b := UI.button("", false, 32)
		var refresh := func() -> void:
			var on := bool(Save.data[key])
			b.text = "%s      %s" % [item[1], "ON" if on else "OFF"]
			b.modulate = Color.WHITE if on else Color(0.7, 0.75, 0.85)
		refresh.call()
		b.pressed.connect(func() -> void:
			Save.data[key] = not bool(Save.data[key])
			Save.save_game()
			Sfx.apply_settings()
			refresh.call())
		v.add_child(b)
	if Ads.privacy_options_required():
		var pc := UI.button("AD PRIVACY CHOICES", false, 28)
		pc.pressed.connect(Ads.show_privacy_options)
		v.add_child(pc)
	if PRIVACY_URL != "":
		var pp := UI.button("PRIVACY POLICY", false, 28)
		pp.pressed.connect(func() -> void: OS.shell_open(PRIVACY_URL))
		v.add_child(pp)
	var note := UI.label("Clip mode hides the HUD for clean screen recordings.\nUse your phone's Back button to pause.", 28, UI.DIM, "body")
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(note)
	v.add_child(_spacer(24))
	var done := UI.button("DONE", true, 40)
	done.pressed.connect(on_close)
	v.add_child(done)
	v.add_child(UI.label("Lurelight v%s" % ProjectSettings.get_setting("application/config/version"), 24, Color(1, 1, 1, 0.3), "body"))
	return root
