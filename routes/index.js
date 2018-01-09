var WebSocket = require('ws');
var wsconfig = require('../config/wsConfig');
var ruleconfig = require('../config/ruleConfig');
var express = require('express');
var router = express.Router();
var querystring = require('querystring');
var https = require('https');
var request = require('request');

var wsLivePath = wsconfig.host + '/live?' + querystring.stringify({sdids : wsconfig.devices.device1.id, authorization : 'bearer+'+wsconfig.devices.device1.token, uid : wsconfig.uid });
	var wsLivePath2 = wsconfig.host + '/live?' + querystring.stringify({sdids : wsconfig.devices.device2.id, authorization : 'bearer+'+wsconfig.devices.device2.token, uid : wsconfig.uid });
	var wsLivePath3 = wsconfig.host + '/live?' + querystring.stringify({sdids : wsconfig.devices.device3.id, authorization : 'bearer+'+wsconfig.devices.device3.token, uid : wsconfig.uid });
var ws = new WebSocket(querystring.unescape(wsLivePath));
var ws2 = new WebSocket(querystring.unescape(wsLivePath2));
var ws3 = new WebSocket(querystring.unescape(wsLivePath3));

var boilerRuleIdArray = ruleconfig.boilerState.lessThan;
var humidRuleIdArray = ruleconfig.humidifierState.lessThan;

var boilerRuleCount = 0;
var humidRuleCount = 0;

var tempLimits = [];
var humidLimits = [];

function getCurrentTempLimit(arr, socket) {
	console.log("CurrentTempLimit");
	if(boilerRuleCount >= 3) {
		socket.emit('tempLimit', arr);
		return;
	}

	var path = '/v1.1/rules/';
	var options = {
		baseUrl : 'https://api.artik.cloud',
		method: 'GET',
		headers : {
			"Content-Type": "application/json",
			"Authorization": "Bearer " + wsconfig.userToken
		}
	}
		
	options.uri = path + boilerRuleIdArray[boilerRuleCount].id;
	console.log(options);
	request(options, function(error, response, data) {
		console.log(data);
		if(!error && response.statusCode === 200) {
			if(boilerRuleCount < 4) {
				boilerRuleCount++;
				console.log("boilerRuleCount: %d" + boilerRuleCount);
				tempLimits.push(JSON.parse(data).data.rule.if.and[0].operand.value);
				getCurrentTempLimit(arr, socket);
			}
		}
	});
}

function getCurrentHumidLimit(arr, socket) {
	if(humidRuleCount >= 3) {
		socket.emit('humidLimit', arr);
		return ;
	}
	var path = '/v1.1/rules/';
	var options = {
		baseUrl : 'https://api.artik.cloud',
		method: 'GET',
		headers : {
			"Content-Type": "application/json",
			"Authorization": "Bearer " + wsconfig.userToken
		}
	}
	options.uri = path + humidRuleIdArray[humidRuleCount].id;
	request(options, function(error, response, data) {
		if(!error && response.statusCode === 200) {
			humidRuleCount++;
			arr.push(JSON.parse(data).data.rule.if.and[0].operand.value);
			getCurrentHumidLimit(arr, socket);
		}
	});
	
}


/* GET home page. */
router.get('/', function(req, res, next) {
	boilerRuleCount = 0;
	humidRuleCount = 0;
	tempLimits.length = 0;
	humidLimits.length = 0;

	req.io.on('connect', function(socket) {
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
		socket.on('getLimitData', function() {
			getCurrentTempLimit(tempLimits, socket);
	//		getCurrentHumidLimit(humidLimits, socket);
		});

		
	})



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
