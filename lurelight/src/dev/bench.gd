class_name Bench
## Developer check: how fast does the lure move for typical thumb motions, at different frame rates?
## Run: godot --headless --path . -- --bench

static func run(host: Node) -> void:
	for fps: int in [60, 30, 120]:
		print("--- %d fps" % fps)
		for pat: Array in [["circle", 3.0], ["circle", 5.0], ["circle", 6.5], ["circle", 8.0], ["circle", 11.0], ["flick", 0.5], ["flick", 0.3], ["flick", 0.18],
				["line", 0.0], ["eight", 4.0]]:
			print(_one(host, pat[0], pat[1], fps))
	# the unlockable fish: same thumb motions, different lure handling
	for id: StringName in Meta.FISH:
		print("--- fish %s (60 fps)" % id)
		for pat: Array in [["circle", 5.0], ["circle", 6.5], ["circle", 8.0], ["flick", 0.3], ["eight", 4.0]]:
			print(_one(host, pat[0], pat[1], 60, id))


static func _one(host: Node, kind: String, p: float, fps: int, fish_id: StringName = &"angler") -> String:
	var def: Dictionary = Meta.FISH[fish_id]
	var fish := Fish.new()
	fish.size = float(def["size"])
	fish.speed = 520.0 * float(def["speed"])
	host.add_child(fish)
	var lure := Lure.new()
	lure.length = World.LURE_LEN * float(def["len"])
	lure.response = float(def["response"])
	host.add_child(lure)
	lure.reset(fish.stalk_anchor())
	var dt := 1.0 / fps
	var acc := 0.0
	var t := 0.0
	var sum := 0.0
	var peak := 0.0
	var n := 0
	var above := 0
	var rad := 0.0
	var fsum := 0.0
	var spin_up := -1.0
	while t < 8.0:
		t += dt
		match kind:
			"circle":
				fish.input_dir = Vector2.from_angle(t * p)
			"flick":
				fish.input_dir = Vector2(1.0 if fmod(t, p * 2.0) < p else -1.0, 0.0)
			"line":
				fish.input_dir = Vector2.RIGHT
			"eight":
				fish.input_dir = Vector2(cos(t * p), sin(t * p * 2.0)).normalized()
		var a0 := fish.stalk_anchor()
		fish.tick(dt)
		var a1 := fish.stalk_anchor()
		acc += dt
		var k := mini(int(acc / World.H), 8)
		acc -= k * World.H
		for i in k:
			lure.step(a0.lerp(a1, float(i + 1) / k), fish.vel, World.H)
		lure.post_step(dt)
		if spin_up < 0.0 and lure.speed > 1200.0:
			spin_up = t
		if t > 3.0:
			sum += lure.speed
			peak = maxf(peak, lure.speed)
			rad += lure.head().distance_to(fish.position)
			fsum += fish.vel.length()
			if lure.speed > 1400.0:
				above += 1
			n += 1
	fish.free()
	lure.free()
	return "%-7s %5.2f  lure mean %5d  peak %5d  time>1400: %3d%%  reach %4d  fish %4d  spin-up %.2fs" % [kind, p, int(sum / n), int(peak), above * 100 / n, int(rad / n), int(fsum / n), spin_up]
