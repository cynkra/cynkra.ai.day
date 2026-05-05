# Cynkra dev day 2026-05-05 : Rise of the Machines

This day is to learn, to exchange and to be human in the face of robots!

The topic is AI workflows.

Please do communicate and have fun! Involve other humans to share knowledge, victories, and raise each other up. 

Interrupting others is OK, today exchange > performance.

## Summary of the day

* 9:00 -> 9:30 Breakfast + Intro + Project brainstorming and choice
* 9:30 -> 12:00 Setup + Green field project!
* 12:00 -> 13:30 Lunch
* 13:30 -> 14:00 Coffee, chat about project challenges, choose brown field projects
* 14:00 -> 16:30 Brown field project!
* 16:30 -> 17:30 debrief: each project = 5 min greenfield + 5 min brownfield + 5 min Q&A

## Guidelines

* Use Claude Code
* Consider using [claude-code-r-skills](https://github.com/ab604/claude-code-r-skills)
* Use openspec (see https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md)
* Try not to write code yourself and see how it goes
* Push to a branch on this repo
* Important: Make actual written notes in the issue tracker of this repo
  * learnings
  * frustrations
  * points you'd like to dive deeper into at some point
  * suggestions to improve the workflow

Outside of this, experiment, feel free to give your own spin to the workflow.

## Project brainstorming and choice

* Share on the clickup chat some ideas you have for projects to vibe code in a day, so remote members can see them too.
* Copy those on the whiteboard too
* Pick a project you like and a partner who likes it too
  * Examples:
    * github/git metric dashboard
    * LLM comparison app
    * options(error = llmdebug) to auto explain errors or propose bugs fixes on error
    * any REST API wrapper
    * any python library wrapper
    * any js library wrapper
    * Interrogate clickup chats from claude
    * Interrogate your email from claude
    * Interrogate your calendar from claude
    * Wrap https://github.com/jolars/panslate from R to provide a translation tool for documents that's an alternative to DeepL (https://docs.ropensci.org/babeldown/)
    * Tree-sitter analysis of base R code (diagnostics through Jarl, but also just stats on most used C/R functions)

## Setup

* Clone this repo
* Create a subfolder within the repo and set it as your project directory
* Create a branch yourproject-main
* Add CLAUDE.md, skills, etc, I suggest copying all folders from the 'claude-code-r-skills' subfolder in your project folder
* Install openspec: `npm install -g @fission-ai/openspec@latest`
* Call `openspec init` and select Claude Code
* Start `claude`

## Green field project

Kickstart suggestion:

* Call `/opsx:propose describe your feature/project here` after replacing the description to initiate the spec files
* Inspect thoroughly all created md files, do not compromise here, this is your "code" today, and it should be clean and meaningful!
* Call `/opsx:apply` to start the work
* Call `/opsx:archive` to move the feature folder to archive (it first syncs)

## Lunch

We will have lunch at Miss-Miu, Badenerstrasse 97 (044 525 00 80).

## Brown field project

* Pick a project you like from another group and a new partner to work on it
    * Try to gather the next steps from the state of the project (might be explicit or not!)
    * Think about the other things you would want
    * Discuss with previous pair about the vision
    * Pick a route or a mix:
      * Keep close to their conventions, like a good contributor
      * Put your own spin, as if you now own the project
      * remove all the specs without looking, commit, and restart the openspec dance, to get a "true" brownfield experience
* You can also choose an external brown field project if you prefer

## API key with Claude Teams (if needed)

API key usage is separate from Claude Teams by default and also more expensive, but we can work around and spend our Claude Team tokens with API keys, do the following.

```
# 1. Install
brew tap router-for-me/tap
brew install cliproxyapi

# 2. Start the service (so it runs in background)
brew services start cliproxyapi                                                                                                                                               
# 3. Login with your Claude account
cliproxyapi --claude-login
```

Then use "your-api-key-1" (literally) as ANTHROPIC_API_KEY.
