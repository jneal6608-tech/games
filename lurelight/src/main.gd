extends Node
## Entry point: owns the current dive (World), the HUD and whichever menu screen is showing.
##
## Test / capture flags (after `--` on the command line):
##   --autoplay           start a dive immediately with the automated player
##   --daily              make that dive the daily dive
##   --shots=DIR          save screenshots into DIR at the times in --shot-times
##   --shot-times=2,10    seconds (comma separated)
##   --quit-after=N       quit after N seconds
##   --screen=NAME        open a screen for a screenshot: menu | levelup | end | pause | settings
##   --zone=N             start the dive in zone N (0-3)
##   --hearts=N           start with N hearts
##   --zone-t=N           start N seconds into the zone (the boss arrives at the zone's length)
##   --muts=heavy:2,twin:1  start with these mutations (store screenshots)
##   --log                print a status line every 15 seconds
##   --uitest             press through every screen with real button and touch events, then quit
##   --bench              print lure speed for scripted thumb motions, then quit
##   --fish=ID            play as this fish (angler | brute | whip | twin), owned or not
##   --nometa             ignore pearl-shop upgrades (baseline balance runs)
##   --fakestore          pretend the Play store is connected; purchases succeed instantly
##   --fakeads            pretend ads are available and always pay out (tests, screenshots)
##   --screen=NAME        also: shop | fish | awards | reward | revive

enum State { MENU, PLAY, LEVELUP, PAUSE, END, REVIVE }

var world: World
var hud: Hud
var state := State.MENU
var daily := false

var _ui: CanvasLayer
var _screen: Control
var _sub_screen: Control
var _touch := -1
var _anchor := Vector2.ZERO
var _args := {}
var _clock := 0.0
var _shot_times: Array = []
var _hint_stage := 0
var _live_saved_t := 0.0
var _toasts: CanvasLayer
var _toast_queue: Array = []
var _toast_t := 0.0
var _ad_rerolled := false  # one ad reroll per level-up


func _ready() -> void:
	get_tree().set_auto_accept_quit(false)
	get_tree().quit_on_go_back = false
	for a: String in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		_args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if _args.has("shot-times"):
		for s: String in String(_args["shot-times"]).split(","):
			_shot_times.append(float(s))
	if _args.has("bench"):
		Bench.run(self)
		set_process(false)
		get_tree().quit()
		return
	hud = Hud.new()
	add_child(hud)
	hud.pause_pressed.connect(_pause)
	_ui = CanvasLayer.new()
	_ui.layer = 20
	add_child(_ui)
	_toasts = CanvasLayer.new()
	_toasts.layer = 30
	add_child(_toasts)
	if _args.has("autoplay"):
		daily = _args.has("daily")
		_start_run()
		world.bot = true
		if _args.has("zone"):
			world.zone = int(_args["zone"])
			world.depth = world.zone_start_depth(world.zone)
			world.apply_zone_colors()
		if _args.has("zone-t"):
			world.zone_t = float(_args["zone-t"])
		if _args.has("muts"):
			for pair: String in String(_args["muts"]).split(","):
				world.muts[StringName(pair.get_slice(":", 0))] = int(pair.get_slice(":", 1))
			world.level = 2 + world.muts.size() * 2
			world.xp_need = world._need(world.level)
			world._recompute()
		if _args.has("hearts"):
			world.max_hearts = int(_args["hearts"])
			world.hearts = world.max_hearts
	else:
		_show_menu(Save.take_cut_off())
	if _args.has("uitest"):
		UiTest.run(self)
	match String(_args.get("screen", "")):
		"levelup":
			_start_run()
			world.muts = {&"heavy": 1, &"twin": 1}
			world.level = 4
			_on_level_up([&"pulse", &"heavy", &"crack"])
		"end":
			_on_run_over({"depth": 1384, "kills": 412, "combo": 57, "time": 203.0, "level": 14, "pearls": 23, "zone": "MIDNIGHT ZONE",
				"muts": {&"heavy": 3, &"twin": 1, &"pulse": 2, &"toxic": 2, &"crack": 1, &"fins": 1}})
		"pause":
			_start_run()
			_pause()
		"settings":
			_open_settings()
		"shop":
			_open_sub(func() -> Control: return MetaScreens.shop(_close_sub))
		"fish":
			_open_sub(func() -> Control: return MetaScreens.fish(_close_sub, _celebrate))
		"awards":
			_open_sub(func() -> Control: return MetaScreens.awards(_close_sub))
		"reward":
			_open_sub(func() -> Control: return MetaScreens.daily_reward(_claim_reward))
		"store":
			_open_sub(func() -> Control: return MetaScreens.store(_close_sub))
		"revive":
			_start_run()
			world.paused = true
			_set_screen(Screens.revive(1384, func() -> void: pass, func() -> void: pass, 60.0))


# ------------------------------------------------------------------ flow
func _set_screen(s: Control) -> void:
	if _screen != null:
		_screen.queue_free()
	_screen = s
	if s != null:
		hud.hide_banner()
		_ui.add_child(s)


func _new_world(attract: bool) -> void:
	if world != null:
		world.queue_free()
	world = World.new()
	world.attract = attract
	world.use_meta = not _args.has("nometa")
	if _args.has("fish"):
		world.fish_kind = StringName(String(_args["fish"]))
	if daily and not attract:
		world.seed_value = hash("lurelight-daily-" + Save.today())
	add_child(world)
	move_child(world, 0)
	hud.bind(world)
	if not attract:
		world.level_up.connect(_on_level_up)
		world.run_over.connect(_on_run_over)


func _show_menu(cut_off := 0) -> void:
	Save.clear_live()
	state = State.MENU
	_new_world(true)
	Sfx.music("menu")
	_set_screen(Screens.menu({
		"play": func() -> void:
			daily = false
			_start_run(),
		"daily": func() -> void:
			daily = true
			_start_run(),
		"settings": _open_settings,
		"fish": func() -> void: _open_sub(func() -> Control: return MetaScreens.fish(_close_sub, _celebrate)),
		"shop": func() -> void: _open_sub(func() -> Control: return MetaScreens.shop(_close_sub)),
		"awards": func() -> void: _open_sub(func() -> Control: return MetaScreens.awards(_close_sub)),
		"store": func() -> void: _open_sub(func() -> Control: return MetaScreens.store(_close_sub)),
	}, cut_off))
	if Meta.reward_ready() and int(Save.data["runs"]) > 0 and _sub_screen == null and not _args.has("screen"):
		_open_sub(func() -> Control: return MetaScreens.daily_reward(_claim_reward, _double_reward if Ads.rewarded_available() else Callable()))


func _start_run() -> void:
	_close_settings()
	_set_screen(null)
	_touch = -1
	_new_world(false)
	state = State.PLAY
	Sfx.play("start")
	Sfx.music("dive")
	_hint_stage = 0 if not bool(Save.data["tutorial_done"]) else 3
	_live_saved_t = _clock
	if not world.bot:
		Save.mark_live(200)
	hud.show_banner("DAILY DIVE" if daily else "TWILIGHT ZONE", "200 m", UI.CYAN)


func _on_level_up(choices: Array) -> void:
	_ad_rerolled = false
	_show_level_up(choices)


func _show_level_up(choices: Array) -> void:
	state = State.LEVELUP
	_release_touch()
	var reroll_text := ""
	if world.rerolls > 0:
		reroll_text = "REROLL   (%d left)" % world.rerolls
	elif Ads.rewarded_available() and not _ad_rerolled:
		reroll_text = "WATCH AD: REROLL"
	_set_screen(Screens.level_up(world, choices, _pick_mutation, reroll_text, _reroll))


func _pick_mutation(id: StringName) -> void:
	if state != State.LEVELUP:
		return
	_set_screen(null)
	state = State.PLAY
	world.choose(id)
	if not bool(Save.data["tutorial_done"]):
		Save.data["tutorial_done"] = true
		Save.save_game()


func _reroll() -> void:
	if state != State.LEVELUP:
		return
	if world.rerolls > 0:
		world.rerolls -= 1
		_show_level_up(world.reroll())
	elif not _ad_rerolled:
		Ads.show_rewarded(func(earned: bool) -> void:
			if earned and state == State.LEVELUP:
				_ad_rerolled = true
				_show_level_up(world.reroll()))


func _on_run_over(stats: Dictionary) -> void:
	_release_touch()
	# one optional second chance per dive, and only for a dive long enough to care about
	if not world.revived and not world.bot and float(stats["time"]) >= 40.0 and Ads.rewarded_available():
		state = State.REVIVE
		_set_screen(Screens.revive(int(stats["depth"]), _revive_watch.bind(stats), _revive_skip.bind(stats)))
		return
	_finish_run(stats)


func _revive_watch(stats: Dictionary) -> void:
	if state != State.REVIVE:
		return
	Ads.show_rewarded(func(earned: bool) -> void:
		if state != State.REVIVE:
			return
		if earned:
			_set_screen(null)
			state = State.PLAY
			world.revive()
		else:
			_finish_run(stats))


func _revive_skip(stats: Dictionary) -> void:
	if state == State.REVIVE:
		_finish_run(stats)


func _finish_run(stats: Dictionary) -> void:
	state = State.END
	Save.data["live_depth"] = 0  # saved by finish_run below
	var result := Meta.finish_run(stats, daily)
	Ads.run_finished()
	if result["new_best"]:
		Sfx.play("record")
	for a: Dictionary in result["unlocked"]:
		_toast(a)
	var on_double := Callable()
	if Ads.rewarded_available():
		on_double = _double_pearls.bind(result)
	_set_screen(Screens.end_card(stats, result, daily, _leave_end.bind(_start_run), _leave_end.bind(_show_menu), on_double))


func _double_pearls(done: Callable, result: Dictionary) -> void:
	if result.has("doubled") or state != State.END:
		return
	Ads.show_rewarded(func(earned: bool) -> void:
		if earned and not result.has("doubled"):
			result["doubled"] = true
			Meta.add_pearls(int(result["earned"]))
			Save.save_game()
			_celebrate()
			done.call())


func _leave_end(next: Callable) -> void:
	## Between dives is the only place an interstitial may appear (pacing rules are in Ads).
	if state != State.END:
		return
	Ads.show_interstitial(func() -> void:
		if state == State.END:
			next.call())


# ------------------------------------------------------------------ between-dive screens
func _open_sub(build: Callable) -> void:
	if _sub_screen != null:
		return
	_sub_screen = build.call()
	_ui.add_child(_sub_screen)


func _close_sub() -> void:
	if _sub_screen == null:
		return
	_sub_screen.queue_free()
	_sub_screen = null
	if state == State.MENU:
		_show_menu()  # pearls, fish and button highlights may all have changed


func _celebrate() -> void:
	for a: Dictionary in Meta.check_achievements():
		_toast(a)


func _claim_reward(mult := 1) -> void:
	var n := Meta.claim_reward(mult)
	if n > 0:
		Sfx.play("record")
		_toast({"name": "Daily reward", "reward": n})
		_celebrate()
	_close_sub()


func _double_reward() -> void:
	Ads.show_rewarded(func(earned: bool) -> void: _claim_reward(2 if earned else 1))


func _toast(a: Dictionary) -> void:
	_toast_queue.append(a)


func _pause() -> void:
	if state != State.PLAY or world == null or not world.running:
		return
	state = State.PAUSE
	world.paused = true
	_release_touch()
	_set_screen(Screens.pause(_resume, _start_run, _show_menu, _open_settings))


func _resume() -> void:
	if state != State.PAUSE:
		return
	_set_screen(null)
	state = State.PLAY
	world.paused = false


func _open_settings() -> void:
	if _sub_screen != null:
		return
	_sub_screen = Screens.settings(_close_settings)
	_ui.add_child(_sub_screen)


func _close_settings() -> void:
	if _sub_screen != null:
		_sub_screen.queue_free()
		_sub_screen = null


func _back() -> void:
	if _sub_screen != null:
		if state != State.MENU:
			_close_settings()
		elif Meta.reward_ready() and int(Save.data["runs"]) > 0:
			_claim_reward()  # backing out of the daily reward still claims it
		else:
			_close_sub()
	elif state == State.REVIVE:
		pass
	elif state == State.PLAY:
		_pause()
	elif state == State.PAUSE:
		_resume()
	elif state == State.END:
		_show_menu()
	elif state == State.MENU:
		get_tree().quit()


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			_back()
		NOTIFICATION_WM_CLOSE_REQUEST:
			Save.save_game()
			get_tree().quit()
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT:
			Save.save_game()
			if not _args.has("autoplay") and world != null and world.bot == false:
				_pause()


# ------------------------------------------------------------------ input
func _release_touch() -> void:
	_touch = -1
	hud.joy_active = false
	hud.joy_vec = Vector2.ZERO
	if world != null:
		world.input_vec = Vector2.ZERO


func _unhandled_input(ev: InputEvent) -> void:
	if ev.is_action_pressed("ui_cancel"):
		_back()
		return
	if state != State.PLAY or world == null or world.bot:
		return
	if ev is InputEventScreenTouch:
		var te: InputEventScreenTouch = ev
		if te.pressed and _touch == -1:
			_touch = te.index
			_anchor = te.position
			hud.joy_active = true
			hud.joy_anchor = _anchor
			hud.joy_vec = Vector2.ZERO
		elif not te.pressed and te.index == _touch:
			_release_touch()
	elif ev is InputEventScreenDrag:
		var de: InputEventScreenDrag = ev
		if de.index != _touch:
			return
		var d := de.position - _anchor
		var l := d.length()
		if l > Hud.JOY_R:
			# the stick follows the thumb, so reversing direction is always quick
			_anchor = de.position - d / l * Hud.JOY_R
			d = de.position - _anchor
			l = Hud.JOY_R
		var v := Vector2.ZERO
		if l > 10.0:
			v = d / l * minf(1.0, (l - 10.0) / (Hud.JOY_R * 0.55))
		world.input_vec = v
		hud.joy_anchor = _anchor
		hud.joy_vec = d / Hud.JOY_R


func _process(delta: float) -> void:
	_clock += delta
	if state == State.PLAY and world != null and not world.bot and _touch == -1:
		world.input_vec = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	_update_hint()
	_toast_t -= delta
	if _toast_t <= 0.0 and not _toast_queue.is_empty():
		var a: Dictionary = _toast_queue.pop_front()
		_toast_t = 3.0
		Sfx.play("combo", -4.0, 1.2)
		_toasts.add_child(MetaScreens.toast(String(a["name"]).to_upper(), "+%d pearls" % int(a["reward"])))
	if state == State.PLAY and world != null and not world.bot and _clock - _live_saved_t > 10.0:
		_live_saved_t = _clock
		Save.mark_live(int(world.depth))
	if _args.has("log") and world != null and not world.attract and int(_clock / 15.0) != int((_clock - delta) / 15.0):
		print("LOG t=%d depth=%d zone=%d kills=%d lvl=%d hearts=%d/%d enemies=%d shots=%d orbs=%d boss=%s fps=%d lure=%d fish=%d nodes=%d objs=%d particles=%d mem=%.1fMB" % [int(world.t), int(world.depth), world.zone, world.kills,
			world.level, world.hearts, world.max_hearts, world.enemies.size(), world.shots.size(), world.orbs.size(), str(world.boss != null), Engine.get_frames_per_second(), int(world.lures[0].speed), int(world.fish.vel.length()),
			Performance.get_monitor(Performance.OBJECT_NODE_COUNT), Performance.get_monitor(Performance.OBJECT_COUNT), world.fx.particle_count(), Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0])
	if not _shot_times.is_empty() and _clock >= float(_shot_times[0]):
		var stamp := float(_shot_times.pop_front())
		_screenshot("%s/shot_%05.1f.png" % [_args.get("shots", "user://"), stamp])
	if _args.has("quit-after") and _clock >= float(_args["quit-after"]):
		if world != null and not world.attract:
			var s := world.stats()
			print("RESULT pearls=%d bosses=%d depth=%d kills=%d combo=%d level=%d time=%.1f hearts=%d zone=%d alive=%s squid_volleys=%d hurt=%s muts=%s" % [s["pearls"], s["bosses"], s["depth"], s["kills"], s["combo"], s["level"], s["time"],
				world.hearts, world.zone, str(world.running), world.squid_volleys, str(s["hurt"]), str(s["muts"])])
		get_tree().quit()


func _update_hint() -> void:
	if world == null or world.attract or state != State.PLAY:
		hud.hint = ""
		return
	match _hint_stage:
		0:
			hud.hint = "DRAG ANYWHERE TO SWIM"
			if world.moved_time > 1.2:
				_hint_stage = 1
		1:
			hud.hint = "CIRCLE YOUR THUMB TO WHIRL THE LURE"
			if world.kills >= 3:
				_hint_stage = 2
		2:
			hud.hint = "FASTER WHIRL = HARDER HITS"
			if world.kills >= 12 or world.level > 1:
				_hint_stage = 3
		_:
			hud.hint = ""


func _screenshot(path: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(path)
	print("SHOT ", path)
