const lineByLine = require('n-readlines');
const Utils = require('./utils.js');
const GameState = require('./GameState');
const config = require('./config.json');
var fs = require('fs');
var path = require('path');

class Game
{
  static get pollQuestion() {
    return "**Vote with reactions:** Which one was written by a human, :a: or :b:?";
  }

  constructor(host, channel)
  {
    //Player who started the game
    this.host = host;
    //List of players (the host is one of them)
    this.players = [host];
    //Player who's impersonating GPT-2
    this.mimic = null;
    
    //Current state of the game (see GameState.js)
    this.state = GameState.Signups;

    //Channel object on which the game is happening.
    this.channel = channel;

    this.prompt = "";
    this.gptsCompletion = "";
    this.mimicsCompletion = "";

    this.humanPoll = null; // a Message

    this.aIsMimic = false; // Mimic's completion presented as :A: (rather than :B:)
    this.humanVotes = new Map(); // from user id to '🅰️' or '🅱'
    this.incriminations = new Map(); // from user id to user id

    this.channel.send("Type `!join` to start playing with "+this.host.username+"!");
  }

  async ready()
  {
    //Choose a random player as Mimic
    this.chooseMimic();
    
    //Choose a prompt
    this.choosePrompt();

    this.channel.send("The game is starting soon, I'm contacting the mimic, please be patient~\n\nThis is the prompt we'll both be writing from:```\n" + this.prompt + "\n```");

    //Send the prompt to the Mimic
    await this.mimic.send("Hey, this is the prompt for this game:");
    await this.mimic.send("```\n" + this.prompt + "\n```");
    await this.mimic.send("Copy this over, complete it (don't change it!) and send it back to me.");
    this.state = GameState.WaitingForMimic;
  }

  chooseMimic()
  {
    this.mimic = this.players[Math.floor(Math.random() * this.players.length)];
    console.log("mimic is: "+this.mimic.username);
  }

  choosePrompt()
  {

    let dataset = '';

    //Find all the files in the datasets folder that have extension .jsonl, and get their name
    let list = 
    fs.readdirSync(`${__dirname}/${config.datasetsFolder}`, {withFileTypes: true})
    .filter(f=>f.name.substring(f.name.length - 6) === '.jsonl')
    .map(f=>f.name);

    if(list.length > 0)
    {
      //Pick one at random
      let randomFile = list[Math.floor(Math.random() * list.length)];

      dataset = `./${config.datasetsFolder}/${randomFile}`;
      console.log(`Picking a prompt from ${dataset}...`);
    } else  {
      this.channel.send(`Hmmm... I can't find a good prompt. Sorry, this game is cancelled.`);
      this.state = GameState.GameOver;
      console.log(`No usable dataset was found in ./${config.datasetsFolder}`);
      return;
    }

    do
    {
      let chosenPromptIndex = Math.floor(Math.random() * 5000);

      //Read the file, line by line
      const liner = new lineByLine(dataset);

      //Fast forward through the file...
      for(let i = 0; i < chosenPromptIndex; i++) { liner.next(); }

      let line = JSON.parse(liner.next().toString('ascii'));
      let fullText = line.text;
      console.log(`Trying ${line.id} (on line ${chosenPromptIndex}): "${line.text.substring(0, 40)}..."`);
      this.gptsCompletion = Utils.sensibleCut(fullText, config.rules.minCompletionLength, config.rules.maxCompletionLength);
      this.prompt = Utils.sensibleCut(this.gptsCompletion, config.rules.minPromptLength, config.rules.maxPromptLength);
      console.log(`The chosen prompt is:${this.prompt}`);
    } while (this.prompt == "" || this.gptsCompletion == "");
  }


  tryJoin(newPlayer)
  {
    //Is the player already in this game?
    if(!this.players.some(p => p.id == newPlayer.id))
    {
      //Yay, new frend
      this.players.push(newPlayer);

      this.channel.send(`${newPlayer.username} has joined the game! There are ${this.players.length} players now. (${this.host.username} can type \`!ready\` to start the game.)`);
    }
  }

  tryAcceptMimicsCompletion(msg)
  {
    if (!msg.content.startsWith(this.prompt)) {
      msg.reply("Your message doesn't start with the prompt.");
      return false;
    }
    if (msg.content.length < config.rules.minCompletionLength) {
      msg.reply(`Your completion should be at least ${config.rules.minCompletionLength} characters; it's only ${msg.content.length}.`);
      return false;
    }
    if (msg.content.length > config.rules.maxCompletionLength) {
      msg.reply(`Your completion should be at most ${config.rules.maxCompletionLength} characters; it's a whopping ${msg.content.length}.`);
      return false;
    }
    
    this.mimicsCompletion = msg.content;
    msg.reply("Gotcha! I'm sending both of our completions to the other players. Play it cool.");
    this.announceCompletions();
    return true;
  }

  async announceCompletions()
  {
    await this.channel.send("Okay, one of these completions was written by me, and one was written by one of you:");
    this.aIsMimic = Math.random() < 0.5;
    const completions = this.aIsMimic ? [this.mimicsCompletion, this.gptsCompletion] : [this.gptsCompletion, this.mimicsCompletion];
    await this.channel.send("**Completion :a:**\n\n" + completions[0]);
    await this.channel.send("**Completion :b:**\n\n" + completions[1]);
    this.humanPoll = await this.channel.send(Game.pollQuestion);
    await this.editHumanPoll();
    await this.channel.send("**Bonus:** If you have a hunch as to which player wrote the completion, @ them now.");
    this.state = GameState.Voting;
    await this.humanPoll.react('🅰');
    await this.humanPoll.react('🅱');
  }

  async editHumanPoll() {
    const playersLeft = this.players.filter(p => !this.humanVotes.has(p.id)).map(p => p.username).join(', ');
    if (playersLeft.length > 0) {
      this.humanPoll = await this.humanPoll.edit(Game.pollQuestion + "\n\nWaiting for votes from: **" + playersLeft + "**");
    } else {
      // Restore the poll message.
      this.humanPoll = await this.humanPoll.edit(Game.pollQuestion);
      this.endVoting();
    }
  }

  async registerHumanVote(user, emoji) {
    this.humanVotes.set(user.id, emoji);
    await this.editHumanPoll();
  }

  async cancelHumanVote(user, emoji) {
    if (emoji === this.humanVotes.get(user.id)) {
      this.humanVotes.delete(user.id);
      await this.editHumanPoll();
    }
  }

  async handleIncrimination(user, suspect) {    
    this.incriminations.set(user.id, suspect.id);
  }

  async endVoting() {
    this.state = GameState.GameOver;

    //Reveal the identity of the mimic
    const emoji = this.aIsMimic ? ':a:' : ':b:';
    let result = `Game over! **The mimic was ${this.mimic.username}, and they wrote ${emoji}.**\n\n`;
    
    //Count the votes
    let voteCount = {right:0, wrong:0};
    
    this.humanVotes.forEach((emoji, userId) => {
      if(emoji === (this.aIsMimic ? '🅰' : '🅱'))
      {
        voteCount.right += 1;
      } else 
      {
        voteCount.wrong += 1;
      }
    }, this)
    let totalVotes = voteCount.right + voteCount.wrong;
    let ratio = ((voteCount.right*1.0/totalVotes).toFixed(2) * 100.0) + "%";

    //Reveal the vote count
    if(totalVotes > 0)
    {
      if(voteCount.right > voteCount.wrong) {
        result += `I count ${voteCount.right} correct vote${voteCount.right>1?'s':''}, that's ${ratio} of them!\n\n`;
      } else if(voteCount.right == voteCount.wrong) {
        result += `Exactly ${ratio} of the votes were correct. A complete tie!\n\n`;
      } else if(voteCount.right > 0) {
        result += `Only ${ratio} of the votes were correct. A convincing impersonation.\n\n`;
      } else {
        result += `Everybody got fooled: none of the votes were correct!\n\n`;
      }
    } else {
      //TODO: What happens if there weren't any votes? :(
    }

    //Assess the incriminations
    let incriminationsCount = this.incriminations.size;
    if(incriminationsCount > 0)
    {
      let incriminationWinners = [];
      this.incriminations.forEach((suspectId, userId) => {
        if(suspectId === this.mimic.id)
        {
          //Retrieve the full user from their id, by using the channel.guild.members Collection
          let winner = this.channel.guild.members.get(userId);
          if(winner !== undefined)
          {
            incriminationWinners.push(winner.user.username);
          }
        }
      }, this);

      result += `${incriminationsCount} finger${incriminationsCount>1?'s':''} ${incriminationsCount>1?'were':'was'} pointed, `;

      //Reveal the incriminations
      if(incriminationWinners.length > 0)
      {
        //["a", "b", "c"] => "a, b and c"
        let prettyListOfNames = Utils.prettyJoin(incriminationWinners, ', ', ' and ');
        result += `and **${prettyListOfNames}** correctly guessed the identity of the mimic. Nice guesswork! I wonder what gave them away...\n\n`;
      } else 
      {
        result += `but nobody could guess exactly who the mimic was. Nice acting, ${this.mimic.username}!\n\n`;
      }
    }
    

    //See you next time~
    result += `Type \`!start\` to play again.`;
    await this.channel.send(result);
  }
}

module.exports = Game;