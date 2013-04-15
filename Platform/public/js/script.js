'use strict';


var MainScript = {

	nav_active : null,

	init : function init() {
		MainScript.navActiveToggle($('#top-nav-menu').children());
	},

	navActiveToggle : function (targets) {

		var active_target = null;

		var toggle = function toggle(e) {

			if (active_target !== null)
				active_target.removeClass('active');

			$(e.currentTarget).addClass('active');
			active_target = $(e.currentTarget);
		}

		$(targets).bind('click', toggle);
	}
}

window.addEventListener("load", MainScript.init);
