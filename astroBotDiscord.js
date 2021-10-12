const Discord = require('discord.js');
const config = require('./config');
const superagent = require('superagent');
const stripIndent = require('strip-indent');

const NASA = new Discord.Client();

NASA.on('ready', () => {
  console.log('Logged into Discord as ' + NASA.user.username);
  console.log('You are in ' + NASA.guilds.size + ` guild${NASA.guilds.size == 1? '' : 's'}!`);
  NASA.prefix = new RegExp('^<@!?' + NASA.user.id + '>');
});

const commands = {
  'help': (message) => sendHelp(message),
  'apod': (message, argument, dm) => {
    let date;
    switch (argument) {
      case 'random':
        const firstAPODDate = new Date(96, 6, 16);
        const currentDate = new Date();
        date = new Date(Math.floor(firstAPODDate.getTime() + Math.random() * (currentDate.getTime() - firstAPODDate.getTime())));
        break;
      case 'today':
        date = new Date();
        break;
      case 'yesterday':
        date = ((d) => new Date(d.setDate(d.getDate() - 1)))(new Date());
        break;
      default:
        date = argument == undefined ? new Date() : new Date(argument);
        if (date == 'Invalid Date') {
          return message.channel.send('That date was invalid, try something like `Janary 30, 1995`, or `1995-1-30`');
        }
        break;
    }
    getAPODImage(date).then((data) => {
      if (!dm) {
        message.channel.startTyping();
        message.channel.send('', new Discord.Attachment(data.url, 'APOD.jpg')).then(() => message.channel.stopTyping());
      }
      if (dm) {
        message.author.send('', new Discord.Attachment(data.url, 'APOD.jpg'));
      }
    });
  },
};

NASA.on('message', (message) => {
  if (!NASA.prefix.test(message.content)) return;

  // [0]: Command, [1] Argument
  message.content = message.content.replace(/[ ]{2,}/, ' ');
  const dm = message.content.includes('-dm');
  const split = message.content.split(' ');
  if (dm) split.splice(split.length - 1, 1);
  const command = split[1];
  let argument;
  if (split.length == 3) argument = split[2];
  if (split.length > 3) argument = `${split[2]} ${parseInt(split[3].replace(/[a-z]/gi, ''))-1} ${split[4]}`;

  if (!command) return;
  switch (command.toLowerCase()) {
    case 'hi':
    case 'hey':
    case 'hello':
      message.reply('Hi!');
      return;
    default:
      if (command.toLowerCase() in commands) {
        commands[command.toLowerCase()](message, argument, dm);
        return;
      }
  }
});

function sendHelp(message) {
  if (message.channel.type != 'dm') message.channel.send('Sending you a DM...').then((message) => message.delete(3000));
  message.author.send(stripIndent(`
	Here's some information on how I can be used.

	apod: Display an Astronomy Picture of the Day image.
	usage: \`<@${NASA.user.id}> apod {option}\`
	**Options:**
	End your command with \`-dm\` to recieve as a DM, rather than the channel.
	random: display a random day's APOD image.
	today:  display today's APOD image.
	yesterday: display yesterday's APOD image.
	{date} displays a specific date's APOD image with {date} in the format: YYYY-MM-DD (Ex: 2016-10-24)
	`));
}

function getAPODImage(date) {
  return new Promise((resolve, reject) => {
    date = formatDate(date);
    superagent.get(`https://api.nasa.gov/planetary/apod?concept_tags=false&api_key=${config.nasa.apiKey}&date=${date}`)
      .end((err, res) => {
        if (err) return reject(err);
        return resolve(res.body);
      });
  });
}


function formatDate(date) {
  let d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  let year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}

NASA.login(config.discord.token);
