var Slack = require('slack-client');
var request = require('request');
var express = require('express');
var http = require('http');
var https = require('https');
var config = require('./config');
setInterval(function () {
  if (config.heroku.url.substring(0, 5) === 'https') {
    https.get(config.heroku.url);
  } else {
    http.get(config.heroku.url);
  }
}, (config.heroku.checkInterval * 60) * 1000); // every 5 minutes(300000)

// Unique token for the AstroBot
var token = config.slack.token;

// Setup an instance of slack with the above token
var slack = new Slack(token, true, true);
var app = express();
var port = process.env.PORT || 3000;

app.listen(port, function () {
  console.log('Slack bot listening on port ' + port);
});

// Commands to execute when the bot is opened
slack.on('open', function () {
  var channels = Object.keys(slack.channels)
    .map(function (k) {
      return slack.channels[k];
    })
    .filter(function (c) {
      return c.is_member;
    })
    .map(function (c) {
      return c.name;
    });
  var groups = Object.keys(slack.groups)
    .map(function (k) {
      return slack.groups[k];
    })
    .filter(function (g) {
      return g.is_open && !g.is_archived;
    })
    .map(function (g) {
      return g.name;
    });
  console.log('Welcome to Slack. You are ' + slack.self.name + ' of ' + slack.team.name);
  if (channels.length > 0) {
    console.log('You are in: ' + channels.join(', '));
  } else {
    console.log('You are not in any channels.');
  }
  if (groups.length > 0) {
    console.log('As well as: ' + groups.join(', '));
  }
});

// Commands to execute when a message is received
slack.on('message', function (message) {
  var channel = slack.getChannelGroupOrDMByID(message.channel);
  var user = slack.getUserByID(message.user);
  // Checks if the message is a message (not an edited, etc) and that the message is to AstroBot
  if (message.type === 'message' && isDirect(slack.self.id, message.text)) {
    // [0]: Username, [1]: Command, [2]: Options, [3] Arguements
    var messageArray = message.text.split(' ');
    // The mention of the bot (to be discarded)
    var username = messageArray[0]; // eslint-disable-line
    // APOD or Help
    var command = messageArray[1];
    // Me, Us, #Channel, APOD
    var option = messageArray[2];
    // Today, Yesterday, Random, YYYY-mm-DD
    var arguement = messageArray[3];
    // Check for specified command (apod, help)
    if (command != null) {
      switch (command.toUpperCase()) {
        case 'apod'.toUpperCase():
          ProcessOptions(option, arguement, channel, user)
          break;
        case 'help'.toUpperCase():
          ProcessOptions(option, arguement, channel, user);
          break;
        case 'hi'.toUpperCase():
        case 'hey'.toUpperCase():
        case 'hello'.toUpperCase():
          channel.send('Hi!');
          break;
        default:
          channel.send('Invalid command. Please use \'@astrobot help\' for more information.');
          break
      }
    } else {
      // Send a brief help message if there was no command
      channel.send('Type \'@astrobot: help\' for usage.');
    }
  }
});
// Process the options that the user specified
function ProcessOptions (option, arguement, channel, user) {
  // Check for specified options
  if (option != null) {
    // Check for the 'me' option (DM to user)
    if (option.toUpperCase() === 'me'.toUpperCase()) {
      // ProcessArguements(arguement, user);
      slack.openDM(user.id, function (res) {
        channel = slack.getChannelGroupOrDMByID(res.channel.id);
        ProcessArguements(arguement, channel, user);
      });
    }
    // Check for the 'us' option (send to the channel the request was maade in)
    else if (option.toUpperCase() === 'us'.toUpperCase()) {
      // Process arguements for the current channel
      ProcessArguements(arguement, channel, user);
    }
    // Check for the 'channel' option (send to the specified channel)
    else if (option.toUpperCase().indexOf('#'.toUpperCase()) > -1) {
      // Option format is <@CHANNEL NAME> - substring to remove <@>
      option = option.substring(2, option.length - 1);
      // Get the channel by the ID of the option
      channel = slack.getChannelByID(option);
      var message = 'Image requested by @' + user.name;
      // Process the arguements for the given channel
      ProcessArguements(arguement, channel, user, message);
    }
    // This should follow
    else if (option.toUpperCase() === 'apod'.toUpperCase()) {
      ProcessHelp(channel, user);
    } else if (option.toUpperCase() === 'help'.toUpperCase()) {
      channel.send('help (?,h): Describe the usage of this bot or its subcommands.\n' +
        'usage: help [SUBCOMMAND...] (Ex: @astrobot help apod)');
    } else {
      try {
        message = 'Image requested by @' + user.name;
        channel.send(message + '\nInvalid option. Please use \'@astrobot help\' for more information.');
      } catch (err) {
        slack.openDM(user.id, function (res) {
          var dmChannel = slack.getChannelGroupOrDMByID(res.channel.id);
          dmChannel.send('Invalid option. Please use \'@astrobot help\' for more information.'); // ProcessHelp(dmChannel);
        });
      }
    }
  }
  // There are no options, show help
  else {
    ProcessHelpNoDetails(channel, user);
  }
}

// Process the command arguements and display the image
function ProcessArguements (arguement, channel, user, message) {
  if (arguement != null) {
    // If there is no message (undefined), create a blank message
    if (message === undefined) {
      message = '';
    }
    // APOD Today
    if (arguement.toUpperCase() === 'today'.toUpperCase()) {
      loadNewImage(new Date(), channel, user, message);
    }
    // APOD Yesterday
    else if (arguement.toUpperCase() === 'yesterday'.toUpperCase()) {
      var yesterdaysDate = new Date();
      yesterdaysDate = yesterdaysDate.setDate(yesterdaysDate.getDate() - 1);
      loadNewImage(yesterdaysDate, channel, user, message);
    }
    // APOD random
    else if (arguement.toUpperCase() === 'random'.toUpperCase()) {
      var numberOfDays = CalculateDaysFromFirstImage();
      var randomInt = randomIntFromInterval(1, numberOfDays);
      var randomDate = new Date();
      randomDate = randomDate.setDate(randomDate.getDate() - randomInt);
      loadNewImage(randomDate, channel, user, message);
    }
    // APOD Date
    else if (isValidDate(arguement)) {
      loadNewImage(arguement, channel, user, message);
    }
    // Not a valid date, DM user help
    else if (!isValidDate(arguement)) {
      try {
        channel.send(message + '\nInvalid arguement. Please use \'@astrobot help\' for more information.');
      } catch (err) {
        slack.openDM(user.id, function (res) {
          var dmChannel = slack.getChannelGroupOrDMByID(res.channel.id);
          dmChannel.send('Invalid arguement. Please use \'@astrobot help\' for more information.'); // ProcessHelp(dmChannel);
        });
      }
    }
  } else {
    ProcessHelp(channel, user);
  }
}
// Query the URL for a given date
function loadNewImage (date, channel, user, message) {
  var formattedDate = formatDate(date);
  message += '\n APOD Image for ' + formattedDate;
  request({
    url: 'https://api.nasa.gov/planetary/apod?concept_tags=false&api_key=' + config.nasa.apiKey + '&date=' + formattedDate,
    json: true
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      SendToChannelCB(body.url, body.title, body.explanation, formattedDate, channel, user, message);
    }
  });
}
// Callback function after the JSON has been parsed and we have the URL
function SendToChannelCB (url, title, description, date, channel, user, message) {
  try {
    channel.postMessage({
      'attachments': [{
        'text': message + '\n' + title + '\n' + description,
        'image_url': url,
        'color': '#FFFFFF',
        'mrkdwn_in': ['text']
      }],
      'username': 'AstroBot',
      'icon_url': 'http://i.imgur.com/1ovnJeD.png',
      'unfurl_links': false,
      'unfurl_media': true
    });
  } catch (err) {
    slack.openDM(user.id, function (res) {
      var dmChannel = slack.getChannelGroupOrDMByID(res.channel.id);
      dmChannel.send('Invalid channel. Please use \'@astrobot help\' for more information.'); // ProcessHelp(dmChannel);
    });
  }
}
// Send help message to the specified channel
function ProcessHelp (channel, user) {
  channel.send('Help requested by: @' + user.name + '\n\n' +
    'apod  : Display an Astronomy Picture of the Day image.\n' +
    'usage  : @astrobot apod {option} {arguement}\n\n' +
    'Valid options:\n' +
    '    me \t\t \t \t \t \t \t: display the image in a direct message to me.\n' +
    '    us \t \t \t \t \t \t \t: display the image in the current channel or group.\n' +
    '    #channel_name \t: display the image in a specified channel.\n\n' +
    'Valid arguements:\n' +
    '    random \t \t \t: display a random day\'s APOD image.\n' +
    '    today \t \t \t \t: display today\'s APOD image.\n' +
    '    yesterday \t \t: display yesterday\'s APOD image.\n' +
    '    {date} \t \t \t \t: displays a specific date\'s APOD image with {date} in the format: MM-DD-YYYY (Ex: 05/25/2006)');
}

function ProcessHelpNoDetails (channel, user) {
  channel.send('Help requested by: @' + user.name + '\n\n' +
    'Use @astrobot help apod for details about each option and arguement\n\n' +
    'apod  : Display an Astronomy Picture of the Day image.\n' +
    'usage  : @astrobot apod {option} {arguement}\n\n' +
    'Valid options:\n' +
    '    me\n' +
    '    us\n' +
    '    #channel_name\n\n' +
    'Valid arguements:\n' +
    '    random\n' +
    '    today\n' +
    '    yesterday\n' +
    '    {date}');
}
// Check if a given date is valid
function isValidDate (str) {
  var matches = str.match(/(\d{1,2})[- . \/](\d{1,2})[- . \/](\d{4})$/);
  if (!matches) return;
  // parse each piece and see if it makes a valid date object
  var month = parseInt(matches[1], 10);
  var day = parseInt(matches[2], 10);
  var year = parseInt(matches[3], 10);
  var date = new Date(year, month - 1, day);
  if (!date || !date.getTime()) return;
  // make sure we have no funny rollovers that the date object sometimes accepts
  // month > 12, day > what's allowed for the month
  if (date.getMonth() + 1 !== month ||
    date.getFullYear() !== year ||
    date.getDate() !== day) {
    return;
  }
  return (date);
}
// Calculate the number of days from the first image (06/16/1996) to today
function CalculateDaysFromFirstImage () {
  var todaysDate = new Date();
  var firstImageDate = new Date('1996', '06', '16');
  var oneDay = 24 * 60 * 60 * 1000; // hours * minutes * seconds * milliseconds
  // (First Date - Second Date) / (one day)
  var dateDifference = Math.round(Math.abs((firstImageDate.getTime() - todaysDate.getTime()) / (oneDay)));
  return dateDifference;
}
// Generate a random number between min and max
function randomIntFromInterval (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
// Format a date into the YYYY-MM-DD format
function formatDate (date) {
  var d = new Date(date);
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}
// Converts a userID into the format recognized by Slack
function makeMention (userId) {
  return '<@' + userId + '>';
};
// Checks if the message was directed at AstroBot
function isDirect (userId, messageText) {
  var userTag = makeMention(userId);
  return messageText &&
    messageText.length >= userTag.length &&
    messageText.substr(0, userTag.length) === userTag;
};
slack.login();
