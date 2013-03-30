bigFont = love.graphics.newFont(40)
bigSize = bigFont:getWidth("You lost. Press 'r'")
normalFont = love.graphics.newFont(12)
function love.load()
	firstclick = true
	gamelost = false
	new(30,30,240)
end

function new(w,h,n,sx,sy)
	t = {}
	width = w
	height = h
	bombn = n
	for i=1,width do
		t[i] = {}
	end
	local x,y
	for _=1,bombn do
		repeat
			x = math.random(width)
			y = math.random(height)
		until (not t[x][y]) and ((not sx) or (((x>sx+1 or x<sx-1) or (y>sy+1 or y<sy-1))))
		t[x][y] = {n=-1,opened=false,marked=false} -- bomb=-1
	end
	compute()
	if love.graphics.getWidth()~=width*20 or love.graphics.getHeight()~=height*20 then love.graphics.setMode(width*20,height*20) end
end

function compute()
	for i=1,width do
		for j=1,height do
			if not t[i][j] then 
				t[i][j] = {n=getAround(i,j),opened = false,marked=false} 
			end
		end
	end
end

function getAround(x,y)
	local count = 0
	for a=-1,1 do
		for b=-1,1 do
			if t[x+a] and t[x+a][y+b] and t[x+a][y+b].n == -1 then count = count + 1 end
		end
	end
	return count
end

function openup()
	local i = 0
	local x,y
	repeat
		i = i + 1
		x,y = unpack(aux[i])
		for a=-1,1 do
			for b=-1,1 do
				if t[x+a]~=nil and t[x+a][y+b]~=nil then 
					if t[x+a][y+b].n==0 and (not t[x+a][y+b].opened) then aux[#aux+1]={x+a,y+b} end
					t[x+a][y+b].opened = true
				end
			end
		end
	until #aux==i
end

function love.mousepressed(x,y,button)
	if gamelost then return end
	x = math.ceil(x/20)
	y = math.ceil(y/20)
	if firstclick then 
		firstclick = false
		new(width,height,bombn,x,y)
	end
	if button=='l' and not t[x][y].marked and not t[x][y].opened then
		t[x][y].opened = true
		if t[x][y].n==0 then aux = {{x,y}} openup() aux = nil
		elseif t[x][y].n==-1 then gamelost = true end
	elseif button=='r' and not t[x][y].opened then t[x][y].marked = not t[x][y].marked end
end

function love.keypressed(key,code)
	if key=='r' then love.load() end
end

function love.draw()
	love.graphics.setBackgroundColor(100,100,100,255)
	for i=1,width do
		for j=1,height do
			if t[i][j].opened then
				love.graphics.setColor(255,255,255,255)
				if t[i][j].n~=0 then love.graphics.printf(t[i][j].n,(i-1)*20,((j-1)*20)+6,20,"center") end
			else
				if t[i][j].marked then love.graphics.setColor(255,100,100,255)
				else love.graphics.setColor(200,200,200,255) end
				love.graphics.rectangle("fill",((i-1)*20)+2,((j-1)*20)+2,16,16)
			end
		end
	end
	if gamelost then
		love.graphics.setFont(bigFont)
		love.graphics.setColor(50,180,50,255)
		love.graphics.rectangle("fill",90,90,bigSize+20,bigFont:getHeight()+20)
		love.graphics.setColor(240,10,10,255)
		love.graphics.print("You lost. Press 'r'", 100,100)
		love.graphics.setFont(normalFont)
	end
end