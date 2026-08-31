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

## register login auth

frontend

```js
async function registerUser({ name, email, password }) {
  const res = await fetch("http://localhost:3000/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.errors?.[0]?.msg || "Registration failed");
  }

  return data;
}
```

backend

```js
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  // validate
  // check duplicate user
  // create user
  // return token or success
});
```
