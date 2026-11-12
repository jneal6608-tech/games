extends Node
## Ads, behind one small interface so the game never talks to an ad SDK directly.
##
##   rewarded_available()      can a rewarded ad be offered right now?
##   show_rewarded(done)       show one; done.call(earned: bool) when it closes
##   interstitial_due()        pacing rules say an interstitial may be shown now
##   show_interstitial(done)   show it; done.call() when it closes (or straight away if none is loaded)
##
## Backends:
##   - Android with the AdMob plugin: real SDK. Uses Google's public TEST ad units until real ids are put in
##     AD_UNITS below and TEST_MODE is turned off (see store/PUBLISHING.md).
##   - `--fakeads` dev flag: every ad "plays" instantly and pays out. For automated tests and screenshots.
##   - everything else (web, desktop): no ads at all; every ad button stays hidden.
##
## Pacing (interstitials only; rewarded ads are always the player's choice):
##   none in the first FIRST_RUNS dives ever, then at most one every RUNS_BETWEEN dives and MIN_GAP seconds,
##   only between dives, never after a dive in which the player chose to watch a rewarded ad,
##   and never once "remove ads" is owned.

signal rewarded_closed(earned: bool)
signal interstitial_closed

const TEST_MODE := true  # true = Google's test ad units, whatever AD_UNITS says
# Real ad unit ids from the AdMob console go here before release. Left empty on purpose.
const AD_UNITS := {"rewarded": "", "interstitial": ""}
# Google's published test units: they always fill, and never earn or cost money.
const TEST_UNITS := {"rewarded": "ca-app-pub-3940256099942544/5224354917", "interstitial": "ca-app-pub-3940256099942544/1033173712"}
const FIRST_RUNS := 5
const RUNS_BETWEEN := 3
const MIN_GAP := 150.0

var backend := "none"  # none | fake | admob
var rewarded_shown := 0  # dev counters
var interstitial_shown := 0

var _last_interstitial := -1000.0
var _watched_this_run := false
var _admob: AdmobBackend


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if OS.get_cmdline_user_args().has("--fakeads"):
		backend = "fake"
	elif OS.get_name() == "Android" and AdmobBackend.plugin_present():
		_admob = AdmobBackend.new()
		add_child(_admob)
		_admob.start(unit("rewarded"), unit("interstitial"))
		backend = "admob"


func privacy_options_required() -> bool:
	## True where the law requires a way to change the ad-consent choice later (EEA / UK): Settings shows a button.
	return backend == "admob" and _admob.privacy_options_required


func show_privacy_options() -> void:
	if backend == "admob":
		_admob.show_privacy_options(func() -> void: pass)


func unit(kind: String) -> String:
	var real := String(AD_UNITS[kind])
	return String(TEST_UNITS[kind]) if TEST_MODE or real == "" else real


func rewarded_available() -> bool:
	match backend:
		"fake":
			return true
		"admob":
			return _admob.rewarded_ready()
	return false


func show_rewarded(done: Callable) -> void:
	if not rewarded_available():
		done.call(false)
		return
	_watched_this_run = true
	rewarded_shown += 1
	if backend == "fake":
		await get_tree().create_timer(0.15).timeout
		done.call(true)
		return
	_admob.show_rewarded(done)


func run_finished() -> void:
	## Call once per finished dive, before interstitial_due().
	Save.data["ad_free_runs"] = int(Save.data["ad_free_runs"]) + 1
	if _watched_this_run:
		Save.data["ad_free_runs"] = 0
	_watched_this_run = false


func interstitial_due() -> bool:
	if backend == "none" or bool(Save.data["no_ads"]):
		return false
	if int(Save.data["runs"]) <= FIRST_RUNS or int(Save.data["ad_free_runs"]) < RUNS_BETWEEN:
		return false
	if Time.get_ticks_msec() / 1000.0 - _last_interstitial < MIN_GAP:
		return false
	return backend == "fake" or _admob.interstitial_ready()


func show_interstitial(done: Callable) -> void:
	if not interstitial_due():
		done.call()
		return
	_last_interstitial = Time.get_ticks_msec() / 1000.0
	Save.data["ad_free_runs"] = 0
	Save.save_game()
	interstitial_shown += 1
	if backend == "fake":
		done.call()
		return
	_admob.show_interstitial(done)
