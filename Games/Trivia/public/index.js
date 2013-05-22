/**
 * @author ReD
 */
"use strict";

  console.log("test2");
  window.onload = function() {
  	console.log("Merge asta");
	var socket = io.connect();
	window._sock = socket;
	socket.on('news', function (data) {
	console.log(data);
	socket.emit('my other event', { my: 'data' });
	});
	socket.on("chat", function (data) {
		console.log("Recived "+data);
		var div = document.querySelector("#a");
		div.innerHTML+="<br/>"+data;
		div.scrollTop = div.scrollHeight-parseInt(div.style.height);
	});
  var input = document.querySelector("#input");
  input.focus();
  console.log(input);
  input.addEventListener('keypress', function(e) {
  	//console.log(e);
  	if (e.keyCode == 13) {
  		console.log("Sending "+input.value);
  		socket.emit("chat", input.value);
  		input.value="";
  	}
  }, false);
};
