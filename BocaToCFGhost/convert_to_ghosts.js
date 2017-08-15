// MODIFY THESE FIELDS
const RUN_FILE = "runlist.html"
const CONTEST_NAME = "2017 USP Try-outs"
const PROBLEMS = [ // A, B, ... (in order)
]
//////////////////////

const jsdom = require("jsdom/lib/old-api.js");
const fs = require("fs");

teams = {}
var tn = 0;
subs = []

jsdom.env(fs.readFileSync(RUN_FILE).toString(),
	["http://code.jquery.com/jquery.js"],
	(err, window) => {
		const $ = window.$;

		$('table:eq(1)').find('tr').each((index, S) => {
			const sub = $(S).children('td');
			if(sub.eq(7).text() != "judged") return;
			const team = sub.eq(2).text();
			const time = sub.eq(3).text();
			const prob = sub.eq(4).text()[0];
			const verd = sub.eq(9).text();
			if(!(team in teams)) teams[team] = ++tn;
			subs.push({team: teams[team], prob: prob, time: time, verd: verd});
		});

		print_ghosts();
	});

function d2(x) {
	return (parseInt(x) < 10? "0" : "") + x;
}

function get_verd(verd) {
	if(verd.match(/^YES/i)) return "OK";
	if(verd.match(/Wrong Answer/i)) return "WA";
	if(verd.match(/Compilation Error/i)) return "CE";
	if(verd.match(/Time limit exceeded/i)) return "TL";
	if(verd.match(/Runtime error/i)) return "RT";
	if(verd.match(/Presentation error/i)) return "PE";
	return "WA"; // weird
}

function print_ghosts() {
	console.log(""); // weird beginning char
	console.log('@contest "' + CONTEST_NAME + '"');
	console.log("@contlen 300");
	console.log("@problems " + PROBLEMS.length);
	console.log("@teams " + tn);
	console.log("@submissions " + subs.length);

	var pn = 0;

	PROBLEMS.forEach((pname) => {
		console.log("@p " + String.fromCharCode('A'.charCodeAt(0) + pn++) + "," + pname + ",20,0");
	});

	for(var team in teams)
		console.log("@t " + d2(teams[team]) + ',0,1,"' + team + '"');
	
	var se = {};
	
	subs.forEach((sub) => {
		var ss = {t: sub.team, p: sub.prob};
		if(!(ss in se))
			se[ss] = 0;
		se[ss]++;
		console.log("@s " + d2(sub.team) + ',' + sub.prob + ',' + se[ss] + ',' + sub.time * 60 + ',' + get_verd(sub.verd));
	});
}


