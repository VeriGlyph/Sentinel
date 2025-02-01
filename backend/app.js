const express = require('express');
const webRouter = require('./routes/web');
const apiRouter = require('./routes/api');
const webhookRouter = require('./routes/webhook');
const chalk = require('chalk');

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use('/', webRouter);
app.use('/api', apiRouter);
app.use('/webhook', webhookRouter);

app.use((err, req, res, next) => {
    res.status(400).send("Something broke!");
});

app.listen(8080, () => {
    console.log(chalk.bold.white("VeriGlyph: Sentinel listening on port 8080"));
});
