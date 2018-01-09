const socketio = require('socket.io');

var io;

module.exports = function(server) {
	if(server) {
		io = socketio(server);
	}
	return io;
};
