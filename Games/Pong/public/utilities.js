function Draggable (element) {

	var offsetX = 0;
	var offsetY = 0;
	var elem =  document.getElementById(element);


	elem.addEventListener('mousedown', start);
	elem.addEventListener('mouseup'  , end);

	function start(e) {
		offsetX = e.clientX - elem.offsetLeft;
		offsetY = e.clientY - elem.offsetTop;
		document.addEventListener('mousemove', drag);
		elem.style.cursor = "move";
	}

	function end(e) {
		document.removeEventListener('mousemove', drag);
		elem.style.cursor = "default";
	};

	function drag(e) {
		elem.style.left = e.clientX - offsetX + 'px';
		elem.style.top  = e.clientY - offsetY + 'px';
	};
}



