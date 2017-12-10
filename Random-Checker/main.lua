drawables = {}
w = 700
tim = 0

function love.load(args)
	love.graphics.setMode(w,w)
	love.graphics.setFont(love.graphics.newFont(18))
	doit(args[2] or 'r.txt')
	timelimit = args[3] or 5
end

function love.draw()
	love.graphics.setColor(255,255,255,255)
	love.graphics.rectangle('fill',0,0,w,w)
	love.graphics.setColor(0,0,0,255)
	for _,d in ipairs(drawables) do
		if d.draw=='text' then 
			love.graphics.print(d[1],d[2],d[3])
		elseif d.draw=='point' then
			love.graphics.setColor(d[3])
			love.graphics.point(d[1],d[2])
		elseif d.draw=='line' then
			love.graphics.setColor(d[2])
			love.graphics.line(unpack(d[1]))
		end
	end
end

function love.update (dt)
	if firsttime == nil then donext() firsttime = false  return end
	tim = tim + dt
	if tim>timelimit then
		tim = 0
		donext()
	end
end

function text(txt,x,y,color) --docolor
	return {txt,x,y, draw = 'text'}
end

function point(x,y,color)
	return {.5+x,.5+w-y,color or {0,0,0}, draw = 'point'}
end

function line(x1,y1,x2,y2,color)
	return {{x1,w-y1,x2,w-y2},color or {0,0,0},draw = 'line'}
end

function ss(c)
	love.graphics.newScreenshot():encode(c..'.png')
end

function doit(filename)
	f = love.filesystem.newFile(filename)
	tests = {montecarlo('4*sqrt(1-x^2)','pi',1,4),divide(1,10),montecarlo('2*x',.25,.5,1),montecarlo('x^2',8/3,2,4),divide(5,5),
		montecarlo('sqrt(2*x-x^2)','pi/4'),divide(8,2)}
	i = 1
end

function donext()
	if i<=#tests+1 and i>1 then ss(i-1) end
	if i>#tests then love.event.push('quit') return end
	drawables = {}
	local test = tests[i]
	i = i + 1
	it = f:lines()
	test(it)
end

function insert(x)
 table.insert(drawables,x)
end

function montecarlo(equation,expected,rangex,rangey)
	rangex = rangex or 1
	rangey = rangey or rangex
	local func = loadstring('setfenv(1,math) return function(x) return '.. equation .. ' end')()
	local expectedstr = expected
	if type(expected)=='string' then 
		expected = loadstring('setfenv(1,math) return ' .. expected)() 
		expectedstr = expectedstr .. ' = ' .. expected
	end
	return function(it)
		for j=1,w do --print equation
			insert(point(j,func(j*rangex/w)*w/rangey,{255,0,0,255}))
		end
	
		local below,all = 0,0
		local y
		for x in it do
			x = x*rangex
			y = it()
			if not y then break end
			y = y*rangey
			insert(point(x*w/rangex,y*w/rangey))
			if y<=func(x) then below = below+1 end
			all = all+1
		end
		insert(text(rangey,10,10))
		insert(text(rangex,w-30,w-20))
		insert(text('Equacao: '..equation, 100,100))
		insert(text('Esperado: '..expectedstr, 100,150))
		local calc = below*rangex*rangey/all
		insert(text('Calculado: '..calc, 100,200))
		insert(text('Desvio: ' .. 100*math.abs(calc-expected)/expected .. '%',100,250))
	end
end

function divide(x,y)
	return function(it)
		local sections = {}
		
		for i=1,x-1 do insert(line(0,i*w/x,w,i*w/x,{255,0,0,255})) end
		for i=1,y-1 do insert(line(i*w/y,0,i*w/y,w,{255,0,0,255})) end
		
		local all = 0
		local column
		for line in it do
			column = it()
			if not column then break end
			line = line + 0
			column = column + 0
			insert(point(line*w,column*w))
			local i1,i2 = math.ceil(line*x),math.ceil(column*y)
			if not sections[i1] then sections[i1] = {} end
			if not sections[i1][i2] then sections[i1][i2] = 0 end
			sections[i1][i2] = sections[i1][i2]+1
			all = all + 1
		end
		
		local expected = all/(x*y)
		local deviation = 0
		for i,a in ipairs(sections) do
			for j,b in ipairs(a) do
				insert(text(b,(j-1)*w/#a + 5,(i-1)*w/#sections + 5,{20,200,20,130}));
				deviation = deviation + math.abs(b-expected)/(x*y)
			end
		end
		
		insert(text('Esperado: ' .. expected,100,100))
		insert(text('Desvio: ' .. 100*deviation/expected .. '%',100,200))
		
	end
end
