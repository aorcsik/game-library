import express from 'express';
import fs from 'fs';
import generateGamesData from './GameLibrary';

const app = express();
const port = 3030;

app.get('/', async (req, res) => {
  const path = `${process.env.SOURCE_DIR}/docs/index.html`;
  await generateGamesData(path);
  res.status(200).sendFile(path);
});

type Manifest = {
  id: string;
  scope: string;
  start_url: string;
};

app.get('/manifest.json', async (req, res) => {
  const path = `${process.env.SOURCE_DIR}/docs/manifest.json`;
  const manifestFile = await fs.promises.readFile(path, 'utf-8');
  const manifest = JSON.parse(manifestFile) as Manifest;
  manifest.start_url = './';
  manifest.scope = './';
  manifest.id = './';
  res.status(200).json(manifest);
});

app.use(express.static('docs'));

app.listen(port, () => {
  process.stdout.write(`Game Library app listening on port ${port}\n\n`);
});