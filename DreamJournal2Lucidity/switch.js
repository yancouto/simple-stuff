$ = jQuery = require('jquery');
require('./jquery.csv.js');
fs = require('fs');

inp = $.csv.toObjects(fs.readFileSync('tmp').toString());

dreams = []
nights = []

var i = 0
inp.forEach((x) => {
	i++;
	nights.push({
		_id: i,
		date: x.dreamdate,
		color: -1
	});

	var text = x.dreambody;
	if(x.dreamnotes != "")
		text += "\n\nNotes: " + x.dreamnotes;
	
	if(x.objectivecontext != "")
		text += "\n\nContext: " + x.objectivecontext;

	if(x.settingassociations != "")
		text += "\n\nAssociation: " + x.settingassociations;

	if(x.associationstofigures != "")
		text += "\n\nAssociation: " + x.associationstofigures;

	if(x.feelings != "")
		text += "\n\nFeelings: " + x.feelings;

	if(x.interpretation != "")
		text += "\n\nInterpration: " + x.interpretation;

	var labels = '[' + x.dreamtype + ']';

	dreams.push({
		_id: i,
		night_id: i,
		title: x.dreamtitle,
		dream_entry: text,
		labels: labels
	});
});

fs.writeFileSync('nights', $.csv.fromObjects(nights));
fs.writeFileSync('dreams', $.csv.fromObjects(dreams));
