import app from "./app";
import { type Request, type Response } from "express";

const port = 3001;

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Backend running on port: ${port}`);
});