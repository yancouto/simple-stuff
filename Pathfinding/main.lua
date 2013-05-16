mapwidth = 100
mapheight = 100

Tile = {
	content = nil
}
Tile.__index = Tile

function Tile:place(o)
	if not o then self.content = nil return end
	if o.currentTile then o.currentTile:remove() end
	o.currentTile = self
	self.content = o
	self.obstructs = o.obstructs
end

function Tile:remove()
	self.content = nil
end

Wall = {
	color = {0,180,30,180},
	obstructs = true
}
Wall.__index = Wall

Player = {
	color = {200,0,100}
}

function Player:moveto(tile)
	local dx, dy = tile[1], tile[2]
	local open = {}
	local selftilebak = self.currentTile
	local ctile = self.currentTile
	local pathfound = false
	ctile.G = 0
	count = 0
	repeat
		for i = -1, 1 do
			for j = -1, 1 do
				if (i~=0 or j~=0) and ctile[1] + i > 0 and ctile[1] + i <= mapwidth and ctile[2] + j > 0 and ctile[2] + j <= mapheight then
					local t = map[ctile[1] + i][ctile[2] + j]
					if t == tile then 
						t.parent = ctile
						pathfound = true 
					end

					if t.obstructs then 
						open[t] = false
					end

					if not pathfound and open[t] ~= false then
						if open[t] == true then
							local newG = ctile.G + ((i*j) == 0 and 10 or 14)
							if newG < t.G then
								t.G = newG
								t.parent = ctile
							end
						else
							open[t] = true
							t.parent = ctile
							t.G = ctile.G + ((i*j) == 0 and 10 or 14)
							t.H = (math.abs(ctile[1] + i - dx) + math.abs(ctile[2] + j - dy)) * 10
							t.F = t.G + t. H
							if t.H == 0 then pathfound = true end
						end
					end
				end
			end
		end
		open[ctile] = false
		ctile = nil
		local minF = 100000
		for k, isOpen in pairs(open) do
			if isOpen then
				if k.F < minF then
					minF  = k.F
					ctile = k
				end
			end
		end
		count = count + 1
	until ctile == nil or pathfound
	
	tile:place {ispath = true, color = {255,0,0,255}}
	repeat
		tile = tile.parent
		tile:place {ispath = true, color = {0,100,170,170}}
	until tile.parent == nil

	selftilebak:place(self)
	print ("done in " .. count .. " fors\tBe proud!\n")
end

function getmap()
	local m = {}
	for i = 1, mapwidth do 
		m[i] = {} 
		for j = 1, mapheight do
			m[i][j] = setmetatable({i,j},Tile)
		end
	end
	return m
end

function getTile(x, y)
	return map[math.floor(x/10) + 1][math.floor(y/10) + 1]
end

function love.load()
	map = getmap()
	map[30][30]:place(Player)
	love.graphics.setColor(160,0,0,40)
end

function love.update(dt)
	if love.mouse.isDown('r') then 
		local t = getTile(love.mouse.getPosition())
		if not t.content then
			t:place(setmetatable({},Wall))
		end
	elseif love.mouse.isDown('m') then
		getTile(love.mouse.getPosition()):remove()
	end
end

function love.draw()
	for i = 1, mapwidth do
		for j = 1, mapheight do
			love.graphics.rectangle('line',(i-1) * 10,(j-1) * 10, 10, 10)
			local content = map[i][j].content
			if content then
				love.graphics.setColor(content.color)
				love.graphics.rectangle('fill',(i-1) * 10,(j-1) * 10, 10, 10)
				love.graphics.setColor(160,0,0,40)
			end
		end
	end
end

function love.mousepressed(x, y, button)
	if button == 'l' then
		local tile = getTile(x, y)
		Player:moveto(tile)
	end
end