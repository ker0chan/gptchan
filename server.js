const Discord = require('discord.js');
const client = new Discord.Client();
const Game = require('./Game');
const GameState = require('./GameState');
require('dotenv').config()

var currentGame = null;

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if(currentGame === null || currentGame.state === GameState.GameOver) {
    handlePreGame(msg);
  } else if (currentGame.state === GameState.Signups) {
    handleSignups(msg);
  } else if (currentGame.state === GameState.WaitingForMimic) {
    handleMimicDms(msg);
  } else if (currentGame.state === GameState.Voting) {
    handleIncriminations(msg);
  }
});

client.on('messageReactionAdd', (reaction, user) => {
  if (currentGame === null || currentGame.state !== GameState.Voting) {
    //It's not time to vote yet.
    return;
  }
  if (reaction.message !== currentGame.humanPoll) {
    //We only look at reactions on the Poll message.
    return;
  }
  if (user.id == client.user.id) {
    //Don't count the bot's own votes.
    return;
  }

  const emoji = reaction.emoji.toString();
  if (emoji === '🅰' || emoji === '🅱') {
    currentGame.registerHumanVote(user, emoji);
  }
});

client.on('messageReactionRemove', (reaction, user) => {
  if (currentGame === null || currentGame.state !== GameState.Voting) {
    return;
  }
  if (reaction.me || reaction.message !== currentGame.humanPoll) {
    return;
  }
  const emoji = reaction.emoji.name;
  if (emoji === '🅰' || emoji === '🅱') {
    currentGame.cancelHumanVote(user, emoji);
  }
});

function handlePreGame(msg)
{

  if (msg.content === '!start' && msg.channel.type === 'text') {
    currentGame = new Game(msg.author, msg.channel);
  }
}

function handleSignups(msg)
{
  if (msg.content === '!join') {
    currentGame.tryJoin(msg.author);
  }

  if (msg.content === '!ready') {
    currentGame.ready();
  }
}

function handleMimicDms(msg)
{
  if (msg.channel.type === 'dm' && msg.author.id === currentGame.mimic.id) {
    currentGame.tryAcceptMimicsCompletion(msg);
  }
}

function handleIncriminations(msg)
{
  //TODO: Prevent players from incriminating themselves?

  //If there's at least one mention in that message, and it's not coming from the bot
  if (msg.mentions.users.size > 0 && msg.author.id !== client.user.id) {
    //The latest mention is used.
    currentGame.handleIncrimination(msg.author, msg.mentions.users.last());
  }

  //Multiple mentions in a single message: remind the players that only the last one is used!
  if(msg.mentions.users.size > 1)
  {
    //TODO: only warn once per game?
    msg.channel.send(`Remember, I'll always consider **the latest name you provided** when mentioning multiple people. Feel free to change your mind as many times as you like, but you can only incriminate one person at a time!`);
  }
}

client.login(process.env.BOT_TOKEN);