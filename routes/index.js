var WebSocket = require('ws');
var wsconfig = require('../config/wsConfig');
var ruleconfig = require('../config/ruleConfig');
var express = require('express');
var router = express.Router();
var querystring = require('querystring');
var https = require('https');
var request = require('request');

/* GET home page. */
router.get('/', function(req, res, next) {
	var wsLivePath = wsconfig.host + '/live?' + querystring.stringify({sdids : wsconfig.devices.device1.id, authorization : 'bearer+'+wsconfig.devices.device1.token, uid : wsconfig.uid });
	var wsLivePath2 = wsconfig.host + '/live?' + querystring.stringify({sdids : wsconfig.devices.device2.id, authorization : 'bearer+'+wsconfig.devices.device2.token, uid : wsconfig.uid });
	var wsLivePath3 = wsconfig.host + '/live?' + querystring.stringify({sdids : wsconfig.devices.device3.id, authorization : 'bearer+'+wsconfig.devices.device3.token, uid : wsconfig.uid });
	req.io.on('connect', function(socket) {
		var ws = new WebSocket(querystring.unescape(wsLivePath));
		var ws2 = new WebSocket(querystring.unescape(wsLivePath2));
		var ws3 = new WebSocket(querystring.unescape(wsLivePath3));
		ws.on('message', function(data) {
			var message = JSON.parse(data);
			if(message.data) {
				socket.volatile.emit('device1Data', message.data);
			}

		});
		ws2.on('message', function(data) {
			var message = JSON.parse(data);
			if(message.data) {
				socket.volatile.emit('device2Data', message.data);
			}

		});
		ws3.on('message', function(data) {
			var message = JSON.parse(data);
			if(message.data) {
				socket.volatile.emit('device3Data', message.data);
			}

		});
	})

	var path = '/v1.1./rules/';
	var boilerRuleIdArray = ruleconfig.boilerState.lessThan;
	var humidRuleIdArray = ruleconfig.humidifierState.lessThan;
	var tempLimits = [];
	var humidLimits = [];
	var options = {
		baseUrl : 'https://api.artik.cloud',
		method: 'GET',
		headers : {
			"Content-Type": "application/json",
			"Authorization": "Bearer " + wsconfig.userToken
		}
	}
	boilerRuleIdArray.forEach((value) => {
		options.uri = path + value.id;
		console.log(options);
		request(options, function(err, res, data) {
			console.log(data);
			if(!err && res.statusCode === 200) {
				tempLimits.push(JSON.parse(data).data.rule.if.and[0].operand.value);
			}
			console.log(tempLimits);
		});
	});

	humidRuleIdArray.forEach((value) => {
		options.uri = path + value.id;
		request(options, function(err, res, data) {
			if(!err && res.statusCode === 200) {
				humidLimits.push(JSON.parse(data).data.rule.if.and[0].operand.value);
			}
			console.log(humidLimits);
		});
	});

  res.render('index', { title: 'Express' });
	

});


var totalRule = 2;
var currentRule = 0;

function changeRule(body) {
	if(currentRule >= totalRule) {
		return;
	}

	var path = '/v1.1/rules/';
	var ruleId = ruleconfig[body.ruleName][currentRule == 0 ? "lessThan" :"greaterThan"][parseInt(body.deviceNo)-1].id;
	var options = {
		baseUrl: 'https://api.artik.cloud',
		method: 'GET',
		headers : {
			"Content-Type": "application/json",
			"Authorization": "Bearer " + wsconfig.userToken
		}
	}
	options.uri = path + ruleId;
	currentRule += 1;
	request(options, function(error, response, data ) {
		if(!error && response.statusCode === 200) {
			var ruleData = JSON.parse(data).data.rule;
			ruleData.if.and[0].operand.value = parseInt(body.value);

			options.method = 'PUT';
			var params = {
				rule : ruleData
			}
			options.body = JSON.stringify(params);

			request(options, function(error2, response2, data2) {
				if(!error2 && response2.statusCode == 200) {
					changeRule(body);
				}
			});
		}
	});
}


router.post('/', function(req, res, next) {
	var body = req.body; // POST 데이터 body
	changeRule(body);
	res.send(JSON.stringify(body));
	res.end();

});


module.exports = router;
