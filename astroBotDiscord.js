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
  'search': (message, argument) => {
    if (!argument) return message.channel.send('You need to include a search term.');

    getNASAImageSearch(argument).then(data => {   
        message.channel.send(data.imageUrl);
        message.channel.send(`**${data.title}**\n${data.description}`);
    }).catch(err => {
        message.channel.send(err.message);
    });
  }
};

NASA.on('message', (message) => {
  if (!NASA.prefix.test(message.content)) return;

  // [0]: Command, [1] Argument
  message.content = message.content.replace(/[ ]{2,}/, ' ');
  const dm = message.content.includes('-dm');
  const split = message.content.split(' ');
  if (dm) split.splice(split.length - 1, 1);
  const command = split[1];
  let argument = split.slice(2).join(' ');

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

  Search: Nasa Random Image Search.
  Supply topic and optional keywords to narrow down search results.
  **Options:**
  Search <topic> <keyword> <etc...>:
  Randomly displays a NASA image, title, and description based on search parameters.
  Example - "search mars curiosity rover"
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

function getNASAImageSearch(argument) {
  return new Promise((resolve, reject) => {
    const keywords = argument.split(' ').join(',');
    superagent.get(`https://images-api.nasa.gov/search?q=${argument}&media_type=image&keywords=${keywords}`)
    .then(res => {
      const items = res.body.collection.items;
      if (items.length > 0) {
        const randomIndex = Math.floor(Math.random() * items.length);
        const item = items[randomIndex];
        const imageUrl = item.links && item.links.length > 0 ? item.links[0].href : null;
        const title = item.data && item.data.length > 0 ? item.data[0].title : "No title available.";
        const description = item.data && item.data.length > 0 ? item.data[0].description : "No description available.";

        if (imageUrl) {
          resolve({ imageUrl, title, description }); 
        }
      } else {
        reject(new Error('No images found. Be sure keywords are separated by spaces.'));
      }
    })
    .catch(err => {
      reject(err);
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
