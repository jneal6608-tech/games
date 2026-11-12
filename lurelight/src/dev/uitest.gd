class_name UiTest
## Scripted end-to-end check of the screen flow, touch input and saving.
## Presses the real buttons (refusing disabled ones) and feeds real touch events through the input system.
## Run: godot --headless --path . -- --uitest

static var _fails := 0


static func run(m: Node) -> void:
	var tree := m.get_tree()
	var fake_ads: bool = Ads.backend == "fake"
	m._close_settings()  # a daily reward may be waiting from an earlier session
	Save.reset()
	m._show_menu()
	var runs_before := int(Save.data["runs"])
	await tree.create_timer(0.6).timeout
	_check("menu is shown on launch", m.state == 0 and m._screen != null and m.world.attract)
	_check("DIVE button works", _press(m._screen, "DIVE"))
	await tree.create_timer(0.3).timeout
	_check("dive started", m.state == 1 and m.world.running and not m.world.attract)

	# touch: press, drag right, release
	var start: Vector2 = m.world.fish.position
	_touch(Vector2(400, 1400), true)
	for i in 20:
		_drag(Vector2(400 + i * 12, 1400))
		await tree.process_frame
	await tree.create_timer(0.4).timeout
	_check("dragging right swims right", m.world.fish.position.x > start.x + 80.0)
	_check("joystick ghost is active", m.hud.joy_active)
	_touch(Vector2(640, 1400), false)
	await tree.process_frame
	await tree.process_frame
	_check("releasing stops the fish input", m.world.input_vec == Vector2.ZERO and not m.hud.joy_active)
	# a second finger must not hijack the stick
	_touch(Vector2(300, 1200), true, 0)
	_touch(Vector2(800, 600), true, 1)
	_drag(Vector2(300, 1000), 0)
	await tree.process_frame
	await tree.process_frame
	_check("second finger is ignored", m.world.input_vec.y < -0.5 and absf(m.world.input_vec.x) < 0.2)
	_touch(Vector2(800, 600), false, 1)
	await tree.process_frame
	_check("lifting the second finger keeps steering", m.hud.joy_active)
	_touch(Vector2(300, 1000), false, 0)

	# level-up
	m.world.xp = m.world.xp_need
	m.world._level_up()
	await tree.process_frame
	_check("level-up pauses the dive", m.state == 2 and m.world.paused)
	var card := _first_button(m._screen)
	_check("cards ignore taps for a moment", card != null and card.disabled)
	await tree.create_timer(0.7).timeout
	_check("cards become tappable", card != null and not card.disabled)
	card.pressed.emit()
	await tree.process_frame
	_check("picking a mutation resumes play", m.state == 1 and not m.world.paused and m.world.muts.size() == 1 and m.world.level == 2)

	# pause, settings, back button
	m.hud.pause_pressed.emit()
	await tree.create_timer(0.2).timeout
	_check("pause button pauses", m.state == 3 and m.world.paused)
	_check("SETTINGS opens", _press(m._screen, "SETTINGS") and m._sub_screen != null)
	var music_before := bool(Save.data["music"])
	_check("MUSIC toggle works", _press(m._sub_screen, "MUSIC") and bool(Save.data["music"]) != music_before
		and AudioServer.is_bus_mute(AudioServer.get_bus_index("Music")) == music_before)
	_press(m._sub_screen, "MUSIC")
	_check("CLIP MODE toggle works", _press(m._sub_screen, "CLIP MODE") and bool(Save.data["clip_mode"]))
	_press(m._sub_screen, "CLIP MODE")
	_check("DONE closes settings", _press(m._sub_screen, "DONE"))
	await tree.process_frame
	_check("settings closed, still paused", m._sub_screen == null and m.state == 3)
	_check("RESUME works", _press(m._screen, "RESUME"))
	await tree.process_frame
	_check("resumed", m.state == 1 and not m.world.paused)
	m._back()
	_check("Back button pauses", m.state == 3)
	m._back()
	_check("Back button resumes", m.state == 1 and not m.world.paused)
	m.notification(Node.NOTIFICATION_APPLICATION_PAUSED)
	_check("leaving the app pauses the dive", m.state == 3)
	m._back()

	# damage and death
	_check("fish is briefly protected after a level-up", m.world.fish.invuln > 0.0)
	m.world.fish.invuln = 0.0
	var h: int = m.world.hearts
	m.world._hurt(m.world.fish.position + Vector2(10, 0))
	_check("a hit costs one heart and grants a moment of safety", m.world.hearts == h - 1 and m.world.fish.invuln > 1.0)
	m.world._hurt(m.world.fish.position + Vector2(10, 0))
	_check("no double damage while flashing", m.world.hearts == h - 1)
	m.world.fish.invuln = 0.0
	m.world.hearts = 1
	m.world.pearls_run = 7
	var pearls_before := int(Save.data["pearls"])
	m.world._hurt(m.world.fish.position + Vector2(10, 0))
	_check("losing the last heart ends the dive", not m.world.running and m.world.fish.dead)
	await tree.create_timer(3.0).timeout
	_check("end card is shown", m.state == 4 and m._screen != null)
	var first_reward := 10  # the "finish a dive" award
	_check("run is recorded, with depth bonus and first award", int(Save.data["runs"]) == runs_before + 1
		and int(Save.data["pearls"]) == pearls_before + 7 + Meta.depth_bonus(int(Save.data["best_depth"])) + first_reward)
	_check("first award is unlocked and toasted", Meta.has_achievement("first_dive") and m._toasts.get_child_count() + m._toast_queue.size() > 0)
	_check("no ad buttons without ads", fake_ads or (_find(m._screen, "WATCH AD") == null))
	var again := _find(m._screen, "DIVE AGAIN")
	_check("end buttons are armed after a delay", again != null and not again.disabled)
	_press(m._screen, "DIVE AGAIN")
	await tree.create_timer(0.3).timeout
	_check("DIVE AGAIN starts a fresh dive", m.state == 1 and m.world.running and m.world.kills == 0 and m.world.hearts == 4)

	# quit to menu, daily dive
	m._back()
	_press(m._screen, "QUIT DIVE")
	await tree.create_timer(0.3).timeout
	_check("QUIT DIVE returns to the menu", m.state == 0 and m.world.attract)
	_check("the daily reward pops up once a dive has been finished", m._sub_screen != null and Meta.reward_ready())
	m._back()
	await tree.process_frame
	_check("daily reward is claimed", m._sub_screen == null and not Meta.reward_ready() and int(Save.data["reward_streak"]) == 1)
	_press(m._screen, "DAILY DIVE")
	await tree.create_timer(0.3).timeout
	_check("daily dive uses a fixed seed", m.daily and m.world.seed_value != 0)
	var first_offer: Array = m.world._offers()
	var w2 := World.new()
	w2.seed_value = m.world.seed_value
	m.add_child(w2)
	_check("daily dive offers are the same for everyone", w2._offers() == first_offer)
	w2.queue_free()
	await _progression(m, tree)
	if fake_ads:
		await _ads(m, tree)

	# a dive that is killed mid-way (tab or app closed) is detected on the next launch
	Save.mark_live(2480)
	Save.load_game()
	_check("a cut-off dive is detected on relaunch", Save.take_cut_off() == 2480 and int(Save.data["live_depth"]) == 0 and int(Save.data["best_depth"]) >= 2480)
	_check("a dive ended normally is not reported", Save.take_cut_off() == 0)

	# save file round trip
	Save.data["best_depth"] = 4321
	Save.save_game()
	Save.data["best_depth"] = 0
	Save.load_game()
	_check("save file survives a reload", int(Save.data["best_depth"]) == 4321 and FileAccess.file_exists(Save.PATH))
	var f := FileAccess.open(Save.PATH, FileAccess.WRITE)
	f.store_string("{ this is not json")
	f.close()
	Save.load_game()
	_check("a corrupt save file does not crash", int(Save.data["best_depth"]) == 4321)
	Save.save_game()

	print("UITEST %s (%d failed)" % ["PASSED" if _fails == 0 else "FAILED", _fails])
	tree.quit(1 if _fails > 0 else 0)


static func _progression(m: Node, tree: SceneTree) -> void:
	# back to the menu with a full purse
	m._back()
	_press(m._screen, "QUIT DIVE")
	await tree.create_timer(0.3).timeout
	Save.data["pearls"] = 2000
	_check("UPGRADES opens the shop", _press(m._screen, "UPGRADES") and m._sub_screen != null)
	var card := _card(m._sub_screen, "DENSE LURE")
	card.pressed.emit()
	_check("buying an upgrade costs pearls and adds a level", Meta.upgrade_level(&"weight") == 1 and int(Save.data["pearls"]) == 1960)
	for i in 6:
		card.pressed.emit()
	_check("an upgrade stops at its maximum", Meta.upgrade_level(&"weight") == 5 and Meta.upgrade_cost(&"weight") == -1
		and int(Save.data["pearls"]) == 2000 - 40 - 80 - 140 - 220 - 320)
	Save.data["pearls"] = 10
	_card(m._sub_screen, "BRIGHT BAIT").pressed.emit()
	_check("cannot buy without enough pearls", Meta.upgrade_level(&"bait") == 0 and int(Save.data["pearls"]) == 10)
	Save.data["pearls"] = 2000
	_card(m._sub_screen, "THICK HIDE").pressed.emit()
	_card(m._sub_screen, "SECOND THOUGHTS").pressed.emit()
	_card(m._sub_screen, "HEAD START").pressed.emit()
	_press(m._sub_screen, "DONE")
	await tree.create_timer(0.2).timeout
	_check("closing the shop returns to a refreshed menu", m._sub_screen == null and m.state == 0)

	# fish
	_check("FISH opens", _press(m._screen, "FISH") and m._sub_screen != null)
	var before := int(Save.data["pearls"])
	card = _card(m._sub_screen, "ANCHORJAW")
	card.pressed.emit()
	_check("unlocking a fish needs a second tap", not Meta.owns_fish(&"brute") and int(Save.data["pearls"]) == before)
	card.pressed.emit()
	_check("second tap unlocks and selects it", Meta.owns_fish(&"brute") and Meta.fish_id() == &"brute" and int(Save.data["pearls"]) == before - 300 + 25)
	_check("unlocking a fish earns its award", Meta.has_achievement("fish_2"))
	_card(m._sub_screen, "LANTERN").pressed.emit()
	_check("tapping an owned fish selects it", Meta.fish_id() == &"angler")
	card.pressed.emit()
	_press(m._sub_screen, "DONE")
	await tree.create_timer(0.2).timeout
	_check("the menu shows the selected fish", m.world.attract and m.world.fish.art == "_brute")
	_press(m._screen, "DIVE")
	await tree.create_timer(0.3).timeout
	var w: World = m.world
	_check("the heavy fish has its own hearts and lure", w.max_hearts == 5 + 1 and w.hearts == 6 and w.lures[0].radius > 30.0 and w.lures[0].response < 1.0)
	_check("damage upgrade applies", is_equal_approx(w.stat_dmg, float(Meta.FISH[&"brute"]["dmg"]) * 1.2))
	await tree.create_timer(1.4).timeout
	_check("Head Start offers a mutation at the start", m.state == 2 and w.level == 1)
	_check("reroll button shows the rerolls left", _find(m._screen, "REROLL   (1 left)") != null)
	await tree.create_timer(0.6).timeout
	_press(m._screen, "REROLL")
	await tree.process_frame
	_check("reroll keeps the choice open and uses one up", m.state == 2 and w.rerolls == 0)
	_check("no second reroll without ads", Ads.backend == "fake" or _find(m._screen, "REROLL") == null)
	await tree.create_timer(0.6).timeout
	_first_button(m._screen).pressed.emit()
	await tree.process_frame
	_check("the free mutation is applied", m.state == 1 and w.muts.size() == 1 and w.level == 1)
	# Gemini starts with two lures
	Save.data["pearls"] = 500
	_check("Gemini can be bought", Meta.buy_fish(&"twin"))
	m._back()
	_press(m._screen, "RESTART")
	await tree.create_timer(0.3).timeout
	_check("Gemini starts with two lures", m.world.lures.size() == 2 and int(m.world.muts[&"twin"]) == 1)

	# awards screen
	m._back()
	_press(m._screen, "QUIT DIVE")
	await tree.create_timer(0.3).timeout
	_check("AWARDS opens", _press(m._screen, "AWARDS") and m._sub_screen != null)
	_press(m._sub_screen, "DONE")
	await tree.process_frame

	# lure glows (cosmetic)
	Save.data["pearls"] = 130
	_check("a glow can be bought with pearls and is selected", Meta.buy_glow(&"ember") and Meta.glow_id() == &"ember" and int(Save.data["pearls"]) == 10)
	_check("Aurora is not sold for pearls", not Meta.buy_glow(&"aurora") and not Meta.owns_glow(&"aurora"))
	_press(m._screen, "DIVE")
	await tree.create_timer(0.3).timeout
	_check("the glow colours the lure", m.world.lures[0].tint.is_equal_approx(Meta.GLOWS[&"ember"]["color"]))
	await tree.create_timer(1.5).timeout  # Head Start opens a mutation choice
	_first_button(m._screen).pressed.emit()
	await tree.process_frame
	m._back()
	_press(m._screen, "QUIT DIVE")
	await tree.create_timer(0.3).timeout

	# store
	if Store.backend == "fake":
		_check("STORE opens", _press(m._screen, "STORE") and m._sub_screen != null)
		var p0 := int(Save.data["pearls"])
		_card(m._sub_screen, "REMOVE ADS").pressed.emit()
		_check("remove ads is granted", bool(Save.data["no_ads"]) and Store.owns("remove_ads"))
		_card(m._sub_screen, "STARTER PACK").pressed.emit()
		_card(m._sub_screen, "STARTER PACK").pressed.emit()
		_check("starter pack pays its pearls once and unlocks Aurora", int(Save.data["pearls"]) == p0 + Store.STARTER_PEARLS and Meta.owns_glow(&"aurora"))
		var p1 := int(Save.data["pearls"])
		var pouch := _card(m._sub_screen, "POUCH OF PEARLS")
		pouch.pressed.emit()
		pouch.pressed.emit()
		_check("pearl packs can be bought again and again", int(Save.data["pearls"]) == p1 + 3000 and not Store.owns("pearls_1500"))
		Save.data["no_ads"] = false
		_press(m._sub_screen, "DONE")
		await tree.create_timer(0.2).timeout
	else:
		_check("no STORE button without a store", _find(m._screen, "STORE") == null)

	# daily reward cycle
	var today := Save.day_index()
	Save.data["reward_last"] = today - 1
	Save.data["reward_streak"] = 2
	_check("reward continues on the next day", Meta.reward_ready() and Meta.reward_day() == 2)
	var p := int(Save.data["pearls"])
	_check("claiming pays the right day", Meta.claim_reward() == Meta.DAILY_REWARDS[2] and int(Save.data["pearls"]) == p + Meta.DAILY_REWARDS[2] and not Meta.reward_ready())
	_check("no second claim the same day", Meta.claim_reward() == 0)
	Save.data["reward_last"] = today - 3
	_check("missing a day restarts the week", Meta.reward_day() == 0)
	Save.data["reward_last"] = today
	# daily dive streak
	var fake := {"depth": 950, "kills": 10, "combo": 5, "level": 3, "pearls": 2, "muts": {}}
	Save.data["daily_last"] = today - 1
	Save.data["daily_streak"] = 2
	var r := Meta.finish_run(fake, true)
	_check("a daily dive on the next day extends the streak", int(r["daily_streak"]) == 3 and int(r["daily_bonus"]) == 25 and int(r["depth_bonus"]) == 9)
	r = Meta.finish_run(fake, true)
	_check("the streak bonus is paid once a day", int(r["daily_bonus"]) == 0 and int(Save.data["daily_streak"]) == 3)
	_check("streak award is earned", Meta.has_achievement("daily_streak_3"))
	Save.data["daily_last"] = today - 2
	_check("a missed day ends the streak", Meta.daily_streak_alive() == 0)


static func _ads(m: Node, tree: SceneTree) -> void:
	# rewarded revive
	Save.data["fish"] = "angler"
	_press(m._screen, "DIVE")
	await tree.create_timer(0.3).timeout
	if m.state == 2:
		await tree.create_timer(1.6).timeout
	while m.state == 2:
		_first_button(m._screen).pressed.emit()
		await tree.create_timer(0.7).timeout
	var w: World = m.world
	w.t = 60.0
	w.fish.invuln = 0.0
	w.hearts = 1
	w.pearls_run = 9
	w._hurt(w.fish.position + Vector2(10, 0))
	await tree.create_timer(3.0).timeout
	_check("a long dive offers a revive", m.state == 5 and _find(m._screen, "WATCH AD: REVIVE") != null)
	await tree.create_timer(0.7).timeout
	var shown: int = Ads.rewarded_shown
	_press(m._screen, "WATCH AD: REVIVE")
	await tree.create_timer(0.5).timeout
	_check("watching the ad revives the fish", m.state == 1 and w.running and not w.fish.dead and w.hearts == 2 and w.revived and Ads.rewarded_shown == shown + 1)
	w.fish.invuln = 0.0
	w.hearts = 1
	w._hurt(w.fish.position + Vector2(10, 0))
	await tree.create_timer(3.0).timeout
	_check("only one revive per dive", m.state == 4)
	var p := int(Save.data["pearls"])
	await tree.create_timer(0.8).timeout
	_check("double pearls is offered", _press(m._screen, "WATCH AD: DOUBLE"))
	await tree.create_timer(0.5).timeout
	_check("double pearls pays once", int(Save.data["pearls"]) > p and _find(m._screen, "PEARLS DOUBLED") != null)
	var p2 := int(Save.data["pearls"])
	m._double_pearls(func() -> void: pass, {"doubled": true, "earned": 50})
	await tree.create_timer(0.3).timeout
	_check("double pearls cannot be claimed twice", int(Save.data["pearls"]) == p2)
	# interstitial pacing
	_check("no interstitial after a dive with a rewarded ad", int(Save.data["ad_free_runs"]) == 0 and not Ads.interstitial_due())
	Save.data["runs"] = 2
	Save.data["ad_free_runs"] = 9
	_check("no interstitial in the first dives", not Ads.interstitial_due())
	Save.data["runs"] = 30
	_check("interstitial is due after enough dives", Ads.interstitial_due())
	Save.data["no_ads"] = true
	_check("remove-ads stops interstitials", not Ads.interstitial_due())
	Save.data["no_ads"] = false
	var n: int = Ads.interstitial_shown
	_press(m._screen, "HOME")
	await tree.create_timer(0.3).timeout
	_check("interstitial shows between dives, then the menu", Ads.interstitial_shown == n + 1 and m.state == 0)
	_check("and not again straight away", not Ads.interstitial_due())
	if m._sub_screen != null:
		m._back()
	await tree.process_frame
	_press(m._screen, "DIVE")
	await tree.create_timer(0.3).timeout


static func _card(root: Node, title: String) -> Button:
	## The card (a Button) that contains a label with this text.
	if root is Label and (root as Label).text == title:
		var n := root.get_parent()
		while n != null and not n is Button:
			n = n.get_parent()
		return n
	for c in root.get_children():
		var b := _card(c, title)
		if b != null:
			return b
	return null


static func _check(name: String, ok: bool) -> void:
	if not ok:
		_fails += 1
	print("%s  %s" % ["ok  " if ok else "FAIL", name])


static func _find(root: Node, text: String) -> Button:
	if root == null:
		return null
	if root is Button and (root as Button).text.begins_with(text):
		return root
	for c in root.get_children():
		var b := _find(c, text)
		if b != null:
			return b
	return null


static func _first_button(root: Node) -> Button:
	if root is Button:
		return root
	for c in root.get_children():
		var b := _first_button(c)
		if b != null:
			return b
	return null


static func _press(root: Node, text: String) -> bool:
	var b := _find(root, text)
	if b == null or b.disabled:
		return false
	b.pressed.emit()
	return true


static func _touch(pos: Vector2, down: bool, index := 0) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = index
	ev.position = pos
	ev.pressed = down
	Input.parse_input_event(ev)


static func _drag(pos: Vector2, index := 0) -> void:
	var ev := InputEventScreenDrag.new()
	ev.index = index
	ev.position = pos
	Input.parse_input_event(ev)
