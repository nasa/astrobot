const Discord = require('discord.js');
const config = require('./config');
const superagent = require('superagent');

const discord = new Discord.Client();

discord.on('ready', () => {
  console.log('Welcome to Discord. You are', discord.user.username);
  console.log('You are in', discord.guilds.size ? discord.guilds.size + ' guilds!' : 'no guilds');
  discord.prefix = new RegExp('^<@!?' + discord.user.id + '>');
});

const commands = {
  'help': (message) => sendHelp(),
  'apod': (message, option, argument) => {
    let date;
    switch (argument) {
      case 'random':
        date = randomDate(new Date('1996-06-16'), new Date());
        break;
      case 'today':
        date = new Date();
        break;
      case 'yesterday':
        date = (d => new Date(d.setDate(d.getDate() - 1)))(new Date());
        break;
      default:
        if (checkDate(argument)) date = new Date(argument);
        else date = new Date();
        break;
    }
    getAPODImage(date).then(data => {
      const msg = `**${data.title}**\n${data.explanation}`;
      switch (option) {
        case 'me':
          message.author.sendFile(data.url, 'APOD.jpg', msg);
          break;
        case 'us':
          message.channel.sendFile(data.url, 'APOD.jpg', msg);
          break;
        default:
          if (message.mentions.channels.size) {
            message.mentions.channels.first().sendFile(data.url, 'APOD.jpg', msg);
          } else {
            message.channel.sendFile(data.url, 'APOD.jpg', msg);
          }
          break;
      }
    });
  }
}

discord.on('message', message => {
  if (!discord.prefix.test(message.content)) return;

  // [0]: Command, [1]: Option, [2] Arguement
  const [command, option, argument] = message.content.split(' ').slice(1);

  switch (command.toLowerCase()) {
    case 'hi':
    case 'hey':
    case 'hello':
      message.reply('Hi!')
      break;
    default:
      if (command.toLowerCase() in commands) {
        commands[command.toLowerCase()](message, option, argument)
      } else {
        message.channel.sendMessage('Invalid command. Please use `@astrobot help` for more information.');
      }
      break;
  }
});

const sendHelp = message => {
  message.channel.sendMessage(`Help requested by ${message.author}

use \`@astrobot help apod\` for details about each option and arguement

apod: Display an Astronomy Picture of the Day image.
  usage: @astrobot apod {option} {arguement}
  Valid Options:
    me: display the image in a direct message to me.
    us: display the image in the current channel or group.
    channel mention: display the image in a specified channel.
  Valid Arguments:
    random: display a random day's APOD image.
    today:  display today's APOD image.
    yesterday: display yesterday's APOD image.
    {date} displays a specific date's APOD image with {date} in the format: YYYY-MM-DD (Ex: 2016-10-24)`);
}

const getAPODImage = date => {
  return new Promise((resolve, reject) => {
    date = formatDate(date);
    superagent.get(`https://api.nasa.gov/planetary/apod?concept_tags=false&api_key=${config.nasa.apiKey}&date=${date}`)
    .end((err, res) => {
      if (err) return reject(err);
      return resolve(res.body);
    })
  })
}

const checkDate = str => {
  if (/(\d{4})[- . \/](\d{1,2})[- . \/](\d{1,2})$/.test(str)) return true;
  return false;
}

// const TimeSinceFirstImage = () => Math.round(Math.abs(new Date('1996-06-16').getTime() - new Date().getTime()) / 86400000);
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const formatDate = date => {
  var d = new Date(date);
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}

discord.login(config.discord.token);
