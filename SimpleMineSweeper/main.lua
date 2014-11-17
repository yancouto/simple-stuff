bigFont = love.graphics.newFont(40)
bigSize = bigFont:getWidth("You lost. Press 'r'")
normalFont = love.graphics.newFont(12)
function love.load()
	firstClick = true
	gameLost = false
	new(30, 30, 240)
end

function bombBehavior(x, y)
	if grid[x][y].marked then return end
	grid[x][y].opened = true
	gameLost = true
end

function noBombBehavior(x, y)
	if grid[x][y].marked or grid[x][y].opened then return end
	grid[x][y].opened = true
	if grid[x][y].n == 0 then
		openUp(x, y)
	end
end

function new(w, h, n, sx, sy)
	grid = {}
	width = w
	height = h
	bombN = n
	for i = 1, width do
		grid[i] = {}
	end
	local x, y
	for _ = 1, bombN do
		repeat
			x = math.random(width)
			y = math.random(height)
		until (not grid[x][y]) and ((not sx) or (((x > sx + 1 or x < sx - 1) or (y > sy + 1 or y < sy - 1))))
		grid[x][y] = {
			n = -1,
			opened = false,
			marked = false,
			behavior = bombBehavior
		} -- bomb = -1
	end
	compute()
	if love.graphics.getWidth() ~= width * 20 or love.graphics.getHeight() ~= height * 20 then 
		local setMode = love.graphics.setMode or love.window.setMode
		setMode(width * 20, height * 20)
	end
end

function compute()
	for i = 1, width do
		for j = 1, height do
			if not grid[i][j] then 
				grid[i][j] = {
					n = getAround(i, j),
					opened = false,
					marked = false,
					behavior = noBombBehavior
				}
			end
		end
	end
end

function getAround(x,y)
	local count = 0
	for a = -1, 1 do
		for b = -1, 1 do
			if grid[x + a] and grid[x + a][y + b] and grid[x + a][y + b].n == -1 then
				count = count + 1
			end
		end
	end
	return count
end

function openUp(x0, y0)
	local i = 0
	local x, y
	local aux = {{x0, y0}}
	repeat
		i = i + 1
		x, y = unpack(aux[i])
		for a = -1, 1 do
			for b = -1, 1 do
				if grid[x + a] ~= nil and grid[x + a][y + b] ~= nil then 
					if grid[x + a][y + b].n == 0 and (not grid[x + a][y + b].opened) then
						aux[#aux + 1] = {x + a, y + b}
					end
					grid[x + a][y + b].opened = true
				end
			end
		end
	until #aux == i
end

function love.mousepressed(x, y, button)
	if gameLost then return end
	x = math.ceil(x / 20)
	y = math.ceil(y / 20)
	if firstClick and button == 'l' then 
		firstClick = false
		new(width, height, bombN, x, y)
	end
	if button == 'l' then
		grid[x][y].behavior(x, y)
	elseif button == 'r' and not grid[x][y].opened then
		grid[x][y].marked = not grid[x][y].marked
	end
end

function love.keypressed(key)
	if key == 'r' then
		love.load()
	end
end

function love.draw()
	love.graphics.setBackgroundColor(100, 100, 100, 255)
	for i = 1, width do
		for j = 1, height do
			if grid[i][j].opened then
				love.graphics.setColor(255, 255, 255, 255)
				if grid[i][j].n ~= 0 then
					love.graphics.printf(grid[i][j].n, (i - 1) * 20,((j - 1) * 20) + 6, 20, "center")
				end
			else
				if grid[i][j].marked then 
						if gameLost and grid[i][j].n ~= -1 then
							love.graphics.setColor(170, 110, 110, 255)
						else
							love.graphics.setColor(255, 100, 100, 255)
						end
				else
					love.graphics.setColor(200, 200, 200, 255)
				end
				love.graphics.rectangle("fill",((i - 1) * 20) + 2,((j - 1) * 20) + 2, 16, 16)
			end
		end
	end
	if gameLost then
		love.graphics.setFont(bigFont)
		love.graphics.setColor(50, 180, 50, 255)
		love.graphics.rectangle("fill", 90, 90, bigSize + 20, bigFont:getHeight() + 20)
		love.graphics.setColor(240, 10, 10, 255)
		love.graphics.print("You lost. Press 'r'", 100, 100)
		love.graphics.setFont(normalFont)
	end
end