const express = require('express');
const generateGamesData = require('./src/js/games.cjs');
const app = express();
const port = 3000;

app.get('/', async (req, res) => {
  await generateGamesData();
  res.sendFile(__dirname + '/docs/index.html');
});

app.use(express.static('docs'));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});