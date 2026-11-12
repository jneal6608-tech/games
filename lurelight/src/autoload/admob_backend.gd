class_name AdmobBackend extends Node
## Talks to the AdMob Android plugin (addons/admob, by Poing Studios). Only Ads uses this.
## Order at start-up: ask Google's consent service whether a consent form is needed (EEA / UK), show it if so,
## then start the SDK and keep one rewarded and one interstitial ad loaded.

const RETRY := 30.0  # seconds before trying again after a failed load

var privacy_options_required := false

var _unit_rewarded := ""
var _unit_interstitial := ""
var _rewarded: RewardedAd
var _interstitial: InterstitialAd
var _loading_rewarded := false
var _loading_interstitial := false
var _started := false
var _load_cb_rewarded := RewardedAdLoadCallback.new()
var _load_cb_interstitial := InterstitialAdLoadCallback.new()


static func plugin_present() -> bool:
	return Engine.has_singleton("PoingGodotAdMob")


func start(rewarded_unit: String, interstitial_unit: String) -> void:
	_unit_rewarded = rewarded_unit
	_unit_interstitial = interstitial_unit
	_load_cb_rewarded.on_ad_loaded = func(ad: RewardedAd) -> void:
		_loading_rewarded = false
		_rewarded = ad
	_load_cb_rewarded.on_ad_failed_to_load = func(err: LoadAdError) -> void:
		_loading_rewarded = false
		print("ads: rewarded failed to load: ", err.message)
		_later(_load_rewarded)
	_load_cb_interstitial.on_ad_loaded = func(ad: InterstitialAd) -> void:
		_loading_interstitial = false
		_interstitial = ad
	_load_cb_interstitial.on_ad_failed_to_load = func(err: LoadAdError) -> void:
		_loading_interstitial = false
		print("ads: interstitial failed to load: ", err.message)
		_later(_load_interstitial)
	# consent first; whatever happens, the SDK is started afterwards (it serves non-personalised ads without consent)
	var info := UserMessagingPlatform.consent_information
	info.update(ConsentRequestParameters.new(), func() -> void:
		privacy_options_required = info.get_privacy_options_requirement_status() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
		if info.get_is_consent_form_available() and info.get_consent_status() == ConsentInformation.ConsentStatus.REQUIRED:
			UserMessagingPlatform.load_consent_form(func(form: ConsentForm) -> void:
				form.show(func(_e: FormError) -> void: _begin()), func(_e: FormError) -> void: _begin())
		else:
			_begin(), func(_e: FormError) -> void: _begin())
	# never wait for the consent service for ever
	get_tree().create_timer(8.0).timeout.connect(_begin)


func _begin() -> void:
	if _started:
		return
	_started = true
	MobileAds.initialize()
	_load_rewarded()
	_load_interstitial()


func show_privacy_options(done: Callable) -> void:
	UserMessagingPlatform.show_privacy_options_form(func(_e: FormError) -> void: done.call())


func _later(what: Callable) -> void:
	get_tree().create_timer(RETRY).timeout.connect(what)


func _load_rewarded() -> void:
	if _rewarded != null or _loading_rewarded:
		return
	_loading_rewarded = true
	RewardedAdLoader.new().load(_unit_rewarded, AdRequest.new(), _load_cb_rewarded)


func _load_interstitial() -> void:
	if _interstitial != null or _loading_interstitial:
		return
	_loading_interstitial = true
	InterstitialAdLoader.new().load(_unit_interstitial, AdRequest.new(), _load_cb_interstitial)


func rewarded_ready() -> bool:
	return _rewarded != null


func interstitial_ready() -> bool:
	return _interstitial != null


func show_rewarded(done: Callable) -> void:
	if _rewarded == null:
		done.call(false)
		return
	var ad := _rewarded
	_rewarded = null
	var state := {"earned": false, "closed": false}
	var finish := func() -> void:
		if state["closed"]:
			return
		state["closed"] = true
		ad.destroy()
		_load_rewarded()
		done.call(state["earned"])
	ad.full_screen_content_callback.on_ad_dismissed_full_screen_content = finish
	ad.full_screen_content_callback.on_ad_failed_to_show_full_screen_content = func(_e: AdError) -> void: finish.call()
	var listener := OnUserEarnedRewardListener.new()
	listener.on_user_earned_reward = func(_item: RewardedItem) -> void: state["earned"] = true
	ad.show(listener)


func show_interstitial(done: Callable) -> void:
	if _interstitial == null:
		done.call()
		return
	var ad := _interstitial
	_interstitial = null
	var state := {"closed": false}
	var finish := func() -> void:
		if state["closed"]:
			return
		state["closed"] = true
		ad.destroy()
		_load_interstitial()
		done.call()
	ad.full_screen_content_callback.on_ad_dismissed_full_screen_content = finish
	ad.full_screen_content_callback.on_ad_failed_to_show_full_screen_content = func(_e: AdError) -> void: finish.call()
	ad.show()
