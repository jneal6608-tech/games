class_name MutIcon extends Control
## Line-art icon for a mutation, drawn in code so every icon shares one style.

var id: StringName = &"heavy"
var level_text := ""


func _init(mut_id: StringName = &"heavy", px := 140.0) -> void:
	id = mut_id
	custom_minimum_size = Vector2(px, px)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var s := minf(size.x, size.y)
	var c := size * 0.5
	var col: Color = Mutations.info(id)["color"]
	var u := s / 100.0
	var w := 5.0 * u
	draw_circle(c, s * 0.5, Color(col.r, col.g, col.b, 0.13))
	draw_arc(c, s * 0.48, 0, TAU, 48, Color(col.r, col.g, col.b, 0.55), 2.5 * u, true)
	match id:
		&"heavy":
			draw_circle(c, 24 * u, col)
			draw_circle(c, 14 * u, Color.WHITE)
			draw_arc(c, 33 * u, 0, TAU, 32, col, w * 0.7, true)
		&"stalk":
			var pts := PackedVector2Array()
			for i in 13:
				var k := i / 12.0
				pts.append(c + Vector2(-30 + 60 * k, 26 - 52 * k + sin(k * PI * 2.0) * 12.0) * u)
			draw_polyline(pts, col, w, true)
			draw_circle(pts[12], 10 * u, Color("ffe27a"))
		&"twin":
			draw_line(c + Vector2(0, 30) * u, c + Vector2(-20, -14) * u, col, w, true)
			draw_line(c + Vector2(0, 30) * u, c + Vector2(20, -14) * u, col, w, true)
			draw_circle(c + Vector2(-20, -18) * u, 13 * u, Color("ffe27a"))
			draw_circle(c + Vector2(20, -18) * u, 13 * u, col)
		&"pulse":
			draw_circle(c, 9 * u, Color.WHITE)
			draw_arc(c, 20 * u, 0, TAU, 32, col, w, true)
			draw_arc(c, 33 * u, 0, TAU, 32, Color(col.r, col.g, col.b, 0.55), w * 0.7, true)
		&"toxic":
			for o: Vector3 in [Vector3(-14, 8, 17), Vector3(12, -4, 20), Vector3(-2, -20, 12), Vector3(18, 20, 10)]:
				draw_circle(c + Vector2(o.x, o.y) * u, o.z * u, Color(col.r, col.g, col.b, 0.5))
			draw_circle(c + Vector2(12, -4) * u, 7 * u, Color.WHITE)
		&"barbs":
			for i in 8:
				var d := Vector2.from_angle(TAU * i / 8.0)
				var sd := d.orthogonal() * 7 * u
				draw_colored_polygon(PackedVector2Array([c + d * 14 * u + sd, c + d * 36 * u, c + d * 14 * u - sd]), col)
			draw_circle(c, 16 * u, Color("ffe27a"))
		&"chain":
			var z := PackedVector2Array([c + Vector2(-8, -36) * u, c + Vector2(-20, 0) * u, c + Vector2(2, -4) * u, c + Vector2(-10, 36) * u,
				c + Vector2(22, -10) * u, c + Vector2(2, -6) * u, c + Vector2(14, -36) * u])
			draw_colored_polygon(z, col)
		&"crack":
			draw_arc(c + Vector2(-22, 0) * u, 34 * u, -0.9, 0.9, 16, col, w * 1.4, true)
			draw_arc(c + Vector2(-38, 0) * u, 34 * u, -0.7, 0.7, 16, Color(col.r, col.g, col.b, 0.5), w, true)
			draw_circle(c + Vector2(-26, 0) * u, 7 * u, Color("ffe27a"))
		&"magnet":
			draw_circle(c, 13 * u, col)
			for i in 6:
				var d := Vector2.from_angle(TAU * i / 6.0 + 0.3)
				draw_circle(c + d * 32 * u, 5 * u, Color.WHITE)
				draw_line(c + d * 26 * u, c + d * 19 * u, Color(col.r, col.g, col.b, 0.7), w * 0.6, true)
		&"fins":
			draw_colored_polygon(PackedVector2Array([c + Vector2(-30, 24) * u, c + Vector2(30, 0) * u, c + Vector2(-30, -24) * u, c + Vector2(-14, 0) * u]), col)
			for i in 3:
				draw_line(c + Vector2(-38, -16 + i * 16) * u, c + Vector2(-26, -16 + i * 16) * u, Color.WHITE, w * 0.6, true)
		&"scales", &"feast":
			_heart(c, 30 * u, col)
			if id == &"scales":
				draw_arc(c, 38 * u, 0, TAU, 32, Color.WHITE, w * 0.5, true)
		&"hoard":
			for o: Vector2 in [Vector2(-14, 10), Vector2(14, 10), Vector2(0, -12)]:
				draw_circle(c + o * u, 13 * u, col)
				draw_circle(c + (o + Vector2(-4, -4)) * u, 4 * u, Color.WHITE)


func _heart(c: Vector2, r: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 40:
		var a := TAU * i / 40.0
		pts.append(c + Vector2(16.0 * pow(sin(a), 3), -(13.0 * cos(a) - 5.0 * cos(2 * a) - 2.0 * cos(3 * a) - cos(4 * a))) * r / 17.0)
	draw_colored_polygon(pts, col)
