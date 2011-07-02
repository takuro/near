$(function(){
  var supported = true;
  function success(position) {
    var lat = position.coords.latitude;
    var lon = position.coords.longitude;
    $.ajax({
      type: "POST",
      url: "/geo",
      data: "lat="+lat+"&lon="+lon,
      success: function(msg){
        alert("ok");
      }
    });
  }
    
  function error(msg) {
    alert(msg);
    supported = false;
  }
      
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error);
  } else {
    error('Not supported');
  }

  if (supported) {
    var socket = new io.Socket(null, {port: 3000});
    var json = JSON.stringify;
    socket.connect();
    socket.on('connect', function() {
      console.log('connect');
    });
    socket.on('message', function(data) {
      var data = JSON.parse(data);
      $('#chat').prepend(data.message + data.name);
    });
    socket.on('disconnect', function(){
      console.log('disconnect');
    });

    $('#form').submit(function() {
      var message = $('#message');
      socket.send(json({name: $('#name').val(), message: message.val()}));
      message.attr('value', '');
      return false;
    });
  }
});

