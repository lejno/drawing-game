# Todo

- [x] timer
- [x] next turn on everyone guessed the word
- [ ] room settings
- [] not picking a word? auto word/skip
- [x] handle afk drawer !!!!!
- [ ] afk timeout ui

## room settings - number of players, topic, time...

- [x] change reqCreateRoom() in server.js
- [x] change handleCreateRoom() in server.js
- [x] settings in server
- [x] sort chat by score? maybe toggle
- [ ] game ended, show top three
- [ ] handle max players on join: allow if players < 8, otherwise delist room from joinable when max is reached
- [ ] token change needs testing + ui

need to connect mongodb data with player

fetch data from db store in server for room? pass down db data somehow? client downloads it and stores it for the room?

DO NOT SEND DATA TO CLIENT - WORD, SOCKETID ETC
send only requested data?
vairfy actions
