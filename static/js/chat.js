var Chat = (function($) {
  var $loginElements;           // elements shown when the user is logged out
  var $usernameField;           // allows the user to input a desired username
  var $loginButton;             // element to which a login function is bound
  var $loginErrors;             // an element where we will place login errors

  var $chatElements;            // elements shown when the user is logged in
  var $usernameDisplay;         // shows the user their current username
  var $messageContainer;        // element to hold messages as they arrive
  var messageTemplate;          // a Mustache template for rendering messages
  var $composeMessageField;     // allows the user to input a chat message
  var $sendMessageButton;       // element to attach a "send message" function to
  var $logoutButton;            // element to which a logout function is bound

  var username = '';            // holds the currently logged in username.  If this
  var loggedIn = false;
  var lastMessageTimestamp = 0; // Timestamp of the last message received
                                // Timestamp is represented as unix epoch time, in
                                // milliseconds.  Probably should truncate that.

  // Removes (some) HTML characters to prevent HTML injection.
  var sanitize = function(text) {
    return text.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  }

  // Scrolls the window to the bottom of the chat dialogue.
  var scrollToEnd = function() {
    $(document).scrollTop($(document).height() + 500);
  }

  // A primitve UI state controller. Call with true to show the "logged in" UI;
  // call with false to show the "logged out" UI.
  var setChatDisplay = function (enabled) {
    $loginElements.toggle(!enabled);
    $chatElements.toggle(enabled);
  }

  // Performs an ajax call to log the user in.  Sends an empty POST request
  // with the username in the request URL.
  var login = function() {
    var desiredUsername = $usernameField.val().trim();
    $.ajax({
      type: "POST",
      url: "/login/" + desiredUsername,
      async: true,
      cache: false,
      timeout: 30000,
      success: function(data){
        username = sanitize(desiredUsername);
        loggedIn = true;
        $usernameDisplay.html(username);
        setChatDisplay(true);
        $loginErrors.toggle(false);
        $composeMessageField.focus();
        poll();
      },
      error: function(XMLHttpRequest, textStatus, errorThrown) {
        $loginErrors.text(errorThrown);
        $loginErrors.toggle(true);
      }
    });
  };

  // Performs an ajax call to log the user out.  Sends an empty DELETE request
  // with the username in the request URL.
  var logout = function() {
    setChatDisplay(false);
    $.ajax({
      type: "DELETE",
      url: "/login/" + username,
      async: true,
      cache: false,
      timeout: 30000,
      success: function(data){
        username = '';
        loggedIn = false;
        toggleDisplay(false);
        $usernameField.focus();
      },
      error: function(XMLHttpRequest, textStatus, errorThrown) {
        displayMessages([{
          timestamp: '',
          timestamp: '',
          nickname: 'system',
          message: errorThrown,
          msgtype: textStatus
        }], '#messages', 0);
      }
    });
  }

  // Given a list of messages, appends them to the $messageContainer element,
  // according to the Mustache template defined as messageTemplate.
  var displayMessages = function(messages) {
    $(messages).each(function(){
      $messageContainer.append(renderMessage(this));
      if(this.timestamp && this.timestamp > lastMessageTimestamp) {
        lastMessageTimestamp = this.timestamp;
      }
    });
    scrollToEnd();
  };

  // Renders a message object using the Mustache template stored in the
  // variable messageTemplate.  Formats the timestamp accordingly. */
  var renderMessage = function(message) {
    var date = new Date();
    date.setTime(message.timestamp);
    message.formattedTime = date.toString().split(' ')[4];
    return Mustache.to_html(messageTemplate, message);
  };

  // Given an input element and a button element, disables the button if the
  // input field is empty.
  var setButtonBehavior = function($inputField, $submitButton){
    var value = $inputField.val().trim();
    if(value){
      $submitButton.removeAttr("disabled");
    } else {
      $submitButton.attr("disabled", "disabled");
    }
  };

  // processes a send message request.  The message is sent as a POST request,
  // with the message text defined in the POST body.
  var sendMessageClick = function(event) {
    var $this = $(this);
    var message = $composeMessageField.val();
    $this.attr("disabled", "disabled");
    $composeMessageField.blur();
    $composeMessageField.attr("disabled", "disabled");

    $.ajax({
      type: 'POST',
      url: '/feed',
      data: 'nickname=' + username + '&message=' + message,
      success: function(){
        $composeMessageField.val("");
      },
      error: function(XMLHttpRequest, textStatus, errorThrown) {
        console.log(errorThrown);
      },
      complete: function(){
        $composeMessageField.removeAttr("disabled");
        $composeMessageField.focus();
        $this.removeAttr("disabled");
      }
    });

    event.preventDefault();
    event.stopPropagation();
    return false;
  };

  // sends a GET request for new messages.  This function will recurse indefinitely.
  var poll = function() {
    if (!loggedIn) {
      return false;
    }
    $.ajax({
      type: "GET",
      url: "/feed",
      async: true,
      cache: false,
      timeout: 1200000,
      data: 'since_timestamp=' + lastMessageTimestamp,
      success: function(data) {
        displayMessages(data.messages);
      },
      error: function(XMLHttpRequest, textStatus, errorThrown) {
        displayMessages([{
          timestamp: '',
          nickname: 'system',
          message: errorThrown,
          msgtype: textStatus
        }], '#messages', lastMessageTimestamp);
      },
      complete: function() {
        poll();
      }
    });
  };

  // Our main setup function.  This function performs no dom manipulation directly,
  // so the layout of your page is preserved after it is called. Accepts a
  // config object as its only argument, which is used to specify jQuery
  // selectors of to bind event listeners to, as well as a Mustache template to
  // dictate how a message should be formatted.
  var buildChatWindow = function(config) {
    $chatElements = $(config.chatElements);
    $messageContainer = $(config.messageContainer);
    $loginButton = $(config.loginButton);
    $logoutButton = $(config.logoutButton);
    $loginElements = $(config.loginElements);
    $loginErrors = $(config.loginErrors);
    $sendMessageButton = $(config.sendMessageButton);
    $composeMessageField = $(config.composeMessageField);
    $usernameField = $(config.usernameField);
    $usernameDisplay = $(config.usernameDisplay);
    messageTemplate = config.messageTemplate;

    $loginButton.click(function(event) {
      login();
      event.preventDefault();
    });

    $logoutButton.click(function(event) {
      logout();
      event.preventDefault();
    });

    $composeMessageField.keyup(function(event) {
      setButtonBehavior($(this), $sendMessageButton);
    });

    $composeMessageField.keydown(function(event) {
      if(event.keyCode == 13 && !event.shiftKey)
        $sendMessageButton.click();
    });

    $(window).unload(function(event){
      logout();
    });

    $usernameField.keyup(function(event) {
      setButtonBehavior($(this), $loginButton);
    });

    $sendMessageButton.click(function(event) {
      sendMessageClick(event);
    });
  };

  var doNothing = function() {
    return false;
  };

  return {
    buildChatWindow: buildChatWindow,
    doNothing: doNothing
  };
})($);
