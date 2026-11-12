extends Node
## Sound effects (pooled, rate-limited), music with crossfade, and haptics.

const SOUNDS := ["hit", "hit_heavy", "clink", "pop", "xp", "pearl", "heart", "levelup", "pick", "hurt", "crack", "pulse", "zap",
	"fizz", "spit", "dash", "warn", "boss_die", "zone", "tap", "start", "gameover", "combo", "record"]
const TRACKS := ["menu", "dive", "boss"]
const POOL := 14
const MUSIC_DB := -9.0

var _streams := {}
var _last := {}
var _pool: Array[AudioStreamPlayer] = []
var _next := 0
var _music: Array[AudioStreamPlayer] = []
var _music_idx := 0
var _track := ""
var _tracks := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for bus: String in ["Music", "SFX"]:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, bus)
		AudioServer.set_bus_send(AudioServer.bus_count - 1, "Master")
	for s: String in SOUNDS:
		_streams[s] = load("res://assets/audio/%s.wav" % s)
	for tname: String in TRACKS:
		var st: AudioStreamOggVorbis = load("res://assets/audio/music_%s.ogg" % tname)
		st.loop = true
		_tracks[tname] = st
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_pool.append(p)
	for i in 2:
		var m := AudioStreamPlayer.new()
		m.bus = "Music"
		m.volume_db = -60.0
		add_child(m)
		_music.append(m)
	apply_settings()


func apply_settings() -> void:
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Music"), not bool(Save.data["music"]))
	AudioServer.set_bus_mute(AudioServer.get_bus_index("SFX"), not bool(Save.data["sfx"]))


func play(sound: String, vol_db := 0.0, pitch := 1.0, min_gap := 0.035) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now - float(_last.get(sound, -1.0)) < min_gap:
		return
	_last[sound] = now
	var p := _pool[_next]
	_next = (_next + 1) % POOL
	p.stream = _streams[sound]
	p.volume_db = vol_db
	p.pitch_scale = clampf(pitch, 0.3, 3.0)
	p.play()


func music(track: String, fade := 1.2) -> void:
	if track == _track:
		return
	_track = track
	var old := _music[_music_idx]
	_music_idx = 1 - _music_idx
	var cur := _music[_music_idx]
	var tw := create_tween().set_parallel(true)
	tw.tween_property(old, "volume_db", -60.0, fade)
	tw.chain().tween_callback(old.stop)
	if track == "":
		return
	var pos := 0.0
	# dive and boss share tempo and bar structure, so keep the playhead for a seamless swap
	if old.playing and track != "menu" and old.stream != _tracks["menu"]:
		pos = old.get_playback_position()
	cur.stream = _tracks[track]
	cur.volume_db = -40.0
	cur.play(pos)
	create_tween().tween_property(cur, "volume_db", MUSIC_DB, fade)


func buzz(ms: int) -> void:
	if bool(Save.data["haptics"]) and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)
