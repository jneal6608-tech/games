extends Node
## In-app purchases, behind one small interface (same idea as Ads).
##
## Backends:
##   - Android with the Google Play Billing plugin (addons/GodotGooglePlayBilling): the real Play purchase flow.
##     Nothing can be bought until the products below exist in the Play Console (see store/PUBLISHING.md); until
##     then the store simply reports itself unavailable and its button stays hidden.
##   - `--fakestore` dev flag: purchases succeed instantly. For automated tests and screenshots.
##   - everything else (web, desktop): no store.
##
## Remove Ads and the Starter Pack are one-time, non-consumable purchases, so Google remembers them: they are
## restored on every launch (and by RESTORE PURCHASES) from Play's own record, with no server of ours involved.
## Pearl packs are consumable: they can be bought again and again. Each one is granted, then "consumed" with
## Play so it can be bought again. A purchase whose grant or consume was interrupted (app killed mid-purchase)
## comes back on the next launch and is finished then; granted purchase tokens are remembered so a pack is
## never paid out twice.

signal changed  # prices arrived, or something was bought or restored

const PRODUCTS := {
	"remove_ads": {"title": "Remove Ads", "desc": "No more ads between dives, for good. Reward ads stay optional.", "color": Color("6be8ff")},
	"starter_pack": {"title": "Starter Pack", "desc": "1,200 pearls and the shimmering Aurora lure glow.", "color": Color("ffd86b")},
	"pearls_500": {"title": "Handful of Pearls", "desc": "500 pearls.", "color": Color("d8ecff"), "pearls": 500, "consumable": true},
	"pearls_1500": {"title": "Pouch of Pearls", "desc": "1,500 pearls.", "color": Color("d8ecff"), "pearls": 1500, "consumable": true},
	"pearls_4000": {"title": "Chest of Pearls", "desc": "4,000 pearls. Best value.", "color": Color("d8ecff"), "pearls": 4000, "consumable": true},
}
const STARTER_PEARLS := 1200

var backend := "none"  # none | fake | play
var prices := {}  # product id -> price text from Google, e.g. "$2.99"

var _billing: BillingClient
var _ready_to_sell := false


func _ready() -> void:
	if OS.get_cmdline_user_args().has("--fakestore"):
		backend = "fake"
		prices = {"remove_ads": "$2.99", "starter_pack": "$1.99", "pearls_500": "$0.99", "pearls_1500": "$2.99", "pearls_4000": "$6.99"}
		_ready_to_sell = true
	elif OS.get_name() == "Android" and Engine.has_singleton("GodotGooglePlayBilling"):
		backend = "play"
		_billing = BillingClient.new()
		add_child(_billing)
		_billing.connected.connect(_on_connected)
		_billing.disconnected.connect(func() -> void: _ready_to_sell = false)
		_billing.connect_error.connect(func(code: int, msg: String) -> void: print("store: cannot connect (%d) %s" % [code, msg]))
		_billing.query_product_details_response.connect(_on_details)
		_billing.query_purchases_response.connect(_on_purchases)
		_billing.on_purchase_updated.connect(_on_purchases)
		_billing.start_connection()


func available() -> bool:
	## True when at least one product can actually be bought right now.
	return _ready_to_sell and not prices.is_empty()


func consumable(id: String) -> bool:
	return bool(PRODUCTS[id].get("consumable", false))


func owns(id: String) -> bool:
	if consumable(id):
		return false
	return bool(Save.data["no_ads"]) if id == "remove_ads" else bool(Save.data["starter_pack"])


func price(id: String) -> String:
	return String(prices.get(id, ""))


func buy(id: String) -> void:
	if owns(id) or not prices.has(id):
		return
	if backend == "fake":
		_grant(id)
	elif backend == "play":
		var r: Dictionary = _billing.purchase(id)
		if int(r.get("response_code", 0)) != BillingClient.BillingResponseCode.OK:
			print("store: purchase did not start: ", r)


func restore() -> void:
	if backend == "play" and _billing.is_ready():
		_billing.query_purchases(BillingClient.ProductType.INAPP)
	elif backend == "play":
		_billing.start_connection()


func _on_connected() -> void:
	_billing.query_product_details(PackedStringArray(PRODUCTS.keys()), BillingClient.ProductType.INAPP)
	_billing.query_purchases(BillingClient.ProductType.INAPP)


func _on_details(response: Dictionary) -> void:
	if int(response.get("response_code", -1)) != BillingClient.BillingResponseCode.OK:
		print("store: product query failed: ", response)
		return
	for d: Variant in response.get("product_details", []):
		if d is Dictionary and PRODUCTS.has(String(d.get("product_id", ""))):
			var p := _find_price(d)
			if p != "":
				prices[String(d["product_id"])] = p
	_ready_to_sell = not prices.is_empty()
	changed.emit()


static func _find_price(v: Variant) -> String:
	## The price text sits a level or two down, and where exactly has moved between billing library versions.
	if v is Dictionary:
		if v.has("formatted_price"):
			return String(v["formatted_price"])
		for k: Variant in v:
			var p := _find_price(v[k])
			if p != "":
				return p
	elif v is Array:
		for item: Variant in v:
			var p := _find_price(item)
			if p != "":
				return p
	return ""


func _on_purchases(response: Dictionary) -> void:
	if int(response.get("response_code", -1)) != BillingClient.BillingResponseCode.OK:
		return
	for p: Variant in response.get("purchases", []):
		if not p is Dictionary or int(p.get("purchase_state", 0)) != BillingClient.PurchaseState.PURCHASED:
			continue  # pending payments (cash, slow cards) are granted when they complete
		var token := String(p.get("purchase_token", ""))
		var is_pack := false
		for id: Variant in p.get("product_ids", []):
			if not PRODUCTS.has(String(id)):
				continue
			if consumable(String(id)):
				is_pack = true
				if not (Save.data["granted_tokens"] as Array).has(token):
					_remember_token(token)
					_grant(String(id))
			else:
				_grant(String(id))
		if is_pack:
			_billing.consume_purchase(token)  # consuming also acknowledges, and lets the pack be bought again
		elif not bool(p.get("is_acknowledged", false)):
			_billing.acknowledge_purchase(token)  # unacknowledged purchases are refunded after 3 days


func _remember_token(token: String) -> void:
	var list: Array = Save.data["granted_tokens"]
	list.append(token)
	while list.size() > 40:
		list.pop_front()


func _grant(id: String) -> void:
	if owns(id):
		return
	match id:
		"remove_ads":
			Save.data["no_ads"] = true
		"starter_pack":
			Save.data["starter_pack"] = true
			Meta.add_pearls(STARTER_PEARLS)
		_:
			Meta.add_pearls(int(PRODUCTS[id]["pearls"]))
	Save.save_game()
	changed.emit()
