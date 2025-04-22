import express from 'express';
import generateGamesData from './GameLibrary';

const app = express();
const port = 3030;

app.get('/', async (req, res) => {
  const path = `${process.env.SOURCE_DIR}/docs/index.html`;
  await generateGamesData(path);
  res.status(200).sendFile(path);
});

app.use(express.static('docs'));

app.listen(port, () => {
  process.stdout.write(`Game Library app listening on port ${port}\n\n`);
});