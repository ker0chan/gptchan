# Pretend You're GPT-2

*Pretend You're GPT-2* is a Discord-based, secret identity game where players take turns impersonating a text-generating program. From a single prompt, a human and a machine will write two distinct texts. Can you guess which one was written by a human? Flex your inner neural networks and be the best *mimic* out there!

Play it here _(TODO: Add a link here.)_

## Usage

Run `npm install`.

Store a `BOT_TOKEN` from your Discord dashboard in a .env file, in the root directory.

Retrieve one of the [output samples](https://github.com/openai/gpt-2-output-dataset) of GPT-2, put it in the `datasets` folder. You can use multiple samples, and one of them will be picked at random at the start of every game. The validation samples are big enough (5000 entries) and not too heavy (~15Mb), making them ideal for this bot.

You can edit the default rules (regarding, for example, the minimum and maximum length of the prompts and completions) in `config.json`.

Run `node server.js` to start the bot.

## How to play

Type `!start` to create a new game. You're the *host*.

Type `!join` to join the current game. The *host* is automatically a part of the game, they don't need to join.

After at least one player has joined, the *host* can type `!ready` to start playing.

The bot will pick a *mimic* at random and DM them the prompt. The bot's own completion of the prompt is kept secret.

As soon as the *mimic* sends a completed prompt back to the bot, the voting round begins. Two completions, 🅰️ and 🅱️, are revealed to the players. Every player who has joined the game needs to vote for one of the two completions. Players can also mention (`@someone`) other participants to incriminate them, if they think they know exactly who was the *mimic*.

When all the players have voted, the results will be revealed. Score (theoretical) points by correctly guessing which text was generated by a human. Score bonus (theoretical) points for guessing exactly who wrote it.

**Note**: Players who haven't joined the game can still vote and incriminate during the voting round. They simply cannot be picked as a *mimic*.

## What is GPT-2? Where do the prompts come from?
More info [over here](https://github.com/openai/gpt-2).
The bot currently uses the [output samples](https://github.com/openai/gpt-2-output-dataset) of GPT-2. The bot's completions are not made in real time: they are taken from these same, premade datasets.