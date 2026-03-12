fetch("https://api.jsonbin.io/v3/b", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ messages: [] })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data)))
.catch(err => console.error(err));
