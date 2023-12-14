const express = require('express');
const apiRouter = require('./routes/api');
const webhookRouter = require('./routes/webhook');
const chalk = require('chalk');

const app = express();

const log = console.log;

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use('/api', apiRouter);
app.use('/webhook', webhookRouter);

app.use((err, req, res, next) => {
    res.status(400).send("Something broke!\n");
})

app.listen(8080, () => {
    log(chalk.bold.white("VeriGlyph: Sentinel listening on port 8080\n"));
});

// module.exports = app;