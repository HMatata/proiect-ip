// Put your custom code here
"use strict";
function update_name() {
	document.getElementById("title").textContent = localStorage.nick;
}


  window.onload = function() {
    console.log("ready");
    window.addEventListener('message', function(event) {
        // We are going to wait for the code that initializes the game session
        console.log(event);
        localStorage.nick = event.data.nickname;
        localStorage.id = event.data._id;
        var socket = io.connect();
        window._sock = socket;
        if (localStorage.id !== undefined) {
            //socket.emit('authenticate', localStorage.id.toString());
            update_name();
        } else {
            socket.emit('authenticate', "");
        }
        socket.on('authenticate', function (data) {
            console.log("auth data:");
            data = JSON.parse(data);
            console.log( data);
            console.log(data.id);
            console.log(data.nick);

            localStorage.id = data.id;
            localStorage.nick = data.nick;
            update_name();
        });
        document.getElementById("answers").addEventListener('click', function (e) {console.log(e.target.textContent); });
        document.getElementById("login").addEventListener('click', function (e){
            console.log(e);
            e.preventDefault();
            socket.emit('login', {user: document.getElementById("username").value,
                                  password: document.getElementById("password").value});
        },true);
        document.getElementById("register").addEventListener('click', function(e){
            console.log(e);
            e.preventDefault();
            socket.emit('register', {user: document.getElementById('r_username').value,
                                     password: document.getElementById('r_password').value,
                                     email: document.getElementById('r_email').value,
                                     id: localStorage.id
                                    });
        },true);
        socket.on('chat', function (data) {
            data = JSON.parse(data);
            console.log("Question: ", data);
            window.question_id  = data.id;
            document.getElementById("question").textContent = data.question;
            var cont = document.getElementById("answers");
            /*for (var el = 0; el < cont.children.length; ++el) {
                var t = cont.children[el];
                console.log("Child",el);
                if (t.tagName == "A")
                    cont.removeChild(t), --el;
            }*/
            cont.innerHTML= "";

            for (var i = 0; i < data.answers.length; ++i) {
                var ans = data.answers[i];
                var button = document.createElement("a");
                button.setAttribute("data-role", "button");
                button.setAttribute("data-theme", "a");
                button.setAttribute("href", "#page1");
                button.textContent = ans;
                //button.addEventListener('click',function(){ socket.emit('chat',ans);}, false);
                cont.appendChild(button);

            }
            $("#page1").trigger("create");
        });
    }, false);
};
