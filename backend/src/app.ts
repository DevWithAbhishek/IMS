import express, { type Express } from 'express';

const app: Express = express();

app.use(express.static('public'));

export default app;