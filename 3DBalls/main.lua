local W, H = love.graphics.getDimensions()

local spheres = {}
local lights = {}

local e = {0, 0, -5} -- eye position
local look = {0, 0, 1} -- look direction
local up = {0, 1, 0} -- up direction
local right = {1, 0, 0} -- right direction
local d = 1
local div = 500
local l, r, b, t = -W/(2*div), W/(2*div), -H/(2*div), H/(2*div)
local Ia = 1 -- ambient light
local eps = 1e-5


local grb_vec = spheres
local grb_id = 1

function love.load()
	spheres[1] = {pos = {0, 0, 0}, r = 1, color = {0, 255, 0}, kd = 2, ka = .1, ks = 2, p = 9}
	spheres[2] = {pos = {2, -1, 0}, r = 1, color = {200, 0, 0}, kd = 3, ka = .2, ks = 4, p = 20}
	spheres[3] = {pos = {2.5, .3, -1}, r = .5, color = {40, 40, 40}, mirror = true, kd = 0, ka = 0, ks = 0, p = 0}
	lights[1] = {pos = {-1.2, 2, 0}, I = 1, ka = 1, kd = 0, ks = 0, r = .1, color = {255, 255, 255}}
	lights[2] = {pos = {-1.2, -1, -1}, I = 1, ka = 1, kd = 0, ks = 0, r = .1, color = {255, 255, 255}}
end

local x, y = 0, 0

local function dot(a, b)
	return a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
end

local function add(a, b)
	return {a[1] + b[1], a[2] + b[2], a[3] + b[3]}
end

local function sub(a, b)
	return {a[1] - b[1], a[2] - b[2], a[3] - b[3]}
end

local function smult(a, k)
	return {a[1] * k, a[2] * k, a[3] * k}
end

local function norm(v)
	local l = math.sqrt(dot(v, v))
	return smult(v, 1/l)
end

local function minus(v)
	return {-v[1], -v[2], -v[3]}
end

local function cross(a, b)
	return {a[2] * b[3] - a[3] * b[2], a[3] * b[1] - a[1] * b[3], a[1] * b[2] - a[2] * b[1]}
end

local show_commands = false

function sphereHit(s, ro, rd, t0, t1)
	local A = dot(rd, rd)
	local B = dot(smult(rd, 2), sub(ro, s.pos))
	local C = dot(sub(ro, s.pos), sub(ro, s.pos)) - s.r * s.r
	local dl = B * B - 4 * A * C
	if dl >= 0 then
		local x = (-B - math.sqrt(dl)) / (2 * A)
		if x >= t0 and x <= t1 then
			return x
		end
	end
end

function hit(ro, rd, t0, t1, no_light)
	local t, obj = 1/0, nil
	for _, s in ipairs(spheres) do
		local x = sphereHit(s, ro, rd, t0, t1)
		if x and x < t then
			t, obj = x, s
		end
	end
	if not no_light then
		for _, l in ipairs(lights) do
			local x = sphereHit(l, ro, rd, t0, t1)
			if x and x < t then
				t, obj = x, l
			end
		end
	end
	return obj, t
end

function rayColor(ro, rd, t0, t1, rec)
	if rec and rec > 3 then return nil end
	local obj, t = hit(ro, rd, t0, t1)
	if obj ~= nil then
		local pos = add(ro, smult(rd, t))
		local L = obj.ka * Ia
		local v = norm(sub(ro, pos))
		local n = norm(sub(pos, obj.pos)) -- assumes it is a sphere
		if obj.mirror then
			local d = norm(sub(pos, ro))
			local r = sub(d, smult(n, 2 * dot(d, n)))
			local c = rayColor(pos, r, eps, 1/0, (rec or 0) + 1)
			if c then return add(smult(c, .9), obj.color)
			else return obj.color end
		end
		if obj.kd ~= 0 or obj.ks ~= 0 then
			for _, lg in ipairs(lights) do
				local l = norm(sub(lg.pos, pos))
				if not hit(pos, l, eps, 1/0, true) then
					local h = norm(add(l, v))
					local r2 = dot(sub(lg.pos, pos), sub(lg.pos, pos))
					L = L + obj.kd * (lg.I / r2) * math.max(0, dot(n, l)) -- diffuse
					L = L + obj.ks * (lg.I / r2) * math.pow(math.max(0, dot(n, h)), obj.p) -- specular
				end
			end
		end
		return smult(obj.color, L)
	end
	return nil
end

function love.draw()
	local color = love.graphics.setColor
	local point = love.graphics.points
	for i = 0, W - 1 do
		for j = 0, H - 1 do
			local u, v = l + ((r - l) / W) * (i + .5),
			             b + ((t - b) / H) * (j + .5)

			-- ray direction
			local rd = add(add(smult(look, d), smult(right, u)), smult(up, v))

			local clr = rayColor(e, rd, 0, 1/0)
			if clr then
				color(clr)
				point(i + .5, (H - 1 - j) + .5)
			end
		end
	end

	color(255, 255, 255)
	love.graphics.print("Press 'f3' to toggle commands list.", 10, 10)
	if show_commands then
		local all = {
			"arrows: controls camera udlr position",
			"z-x: controls camera in and out",
			"a-s: controls in-game proj screen size",
			"e-r: rotate camera",
			"q-w: look left-right",
			"d-f: look down-up",
			"f1: grab spheres",
			"f2: grab lights",
			"t-y: grabbed object left-right (cam rel)",
			"g-h: grabbed object down-up (cam rel)",
			"b-n: grabbed object in-out (cam rel)",
		}
		for i, s in ipairs(all) do
			love.graphics.print(s, 10, 20 + 15 * i)
		end
	end
	if grb_vec == spheres then love.graphics.print("Grabbing Sphere " .. grb_id, 300, 10) end
	if grb_vec == lights then love.graphics.print("Grabbing Light " .. grb_id, 300, 10) end
end

function love.update(dt)
	local down = love.keyboard.isDown
	local v = 1
	if down('left') then e = sub(e, smult(right, v * dt)) end
	if down('right') then e = add(e, smult(right, v * dt)) end
	if down('down') then e = sub(e, smult(up, v * dt)) end
	if down('up') then e = add(e, smult(up, v * dt)) end
	if down('z') then e = sub(e, smult(look, v * dt)) end
	if down('x') then e = add(e, smult(look, v * dt)) end
	if down('a') then
		div = div + 100 * dt
		l, r, b, t = -W/(2*div), W/(2*div), -H/(2*div), H/(2*div)
	end
	if down('s') then
		div = div - 100 * dt
		l, r, b, t = -W/(2*div), W/(2*div), -H/(2*div), H/(2*div)
	end
	if down('r') then
		up = norm(add(up, smult(right, dt)))
		right = cross(up, look)
	end
	if down('e') then
		up = norm(sub(up, smult(right, dt)))
		right = cross(up, look)
	end
	if down('w') then
		look = norm(add(look, smult(right, dt * .3)))
		right = cross(up, look)
	end
	if down('q') then
		look = norm(sub(look, smult(right, dt * .3)))
		right = cross(up, look)
	end
	if down('f') then
		look = norm(add(look, smult(up, dt * .3)))
		up = cross(look, right)
	end
	if down('d') then
		look = norm(sub(look, smult(up, dt * .3)))
		up = cross(look, right)
	end
	local g, i = grb_vec, grb_id
	if down('t') then g[i].pos = sub(g[i].pos, smult(right, v * dt)) end
	if down('y') then g[i].pos = add(g[i].pos, smult(right, v * dt)) end
	if down('g') then g[i].pos = sub(g[i].pos, smult(up, v * dt)) end
	if down('h') then g[i].pos = add(g[i].pos, smult(up, v * dt)) end
	if down('b') then g[i].pos = sub(g[i].pos, smult(look, v * dt)) end
	if down('n') then g[i].pos = add(g[i].pos, smult(look, v * dt)) end
end

function love.keypressed(k)
	if k == 'f3' then show_commands = not show_commands end
	if k == 'f1' then
		if grb_vec == spheres then
			grb_id = 1 + (grb_id % #grb_vec)
		else
			grb_vec = spheres
			grb_id = 1
		end
	end
	if k == 'f2' then
		if grb_vec == lights then
			grb_id = 1 + (grb_id % #grb_vec)
		else
			grb_vec = lights
			grb_id = 1
		end
	end
end
