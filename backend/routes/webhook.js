const express = require('express');
const router = express.Router();
const Sentinel = require('../Sentinel');
const chalk = require('chalk');

const log = console.log;

router.post('/', (req, res) => {
    if (req.body.variant !== "Metadata") {
        log(chalk.bold.red("BAD REQUEST"));
        res.send('OK');
        return;
    }

    if (req.body.metadata.label !== "867") {
        log(chalk.bold.red("INVALID METADATA INDEX!"));
        res.send('OK');
        return;
    }

    const certificate = req.body.metadata.map_json;
    const sentinel = new Sentinel();
    const valid_certificate = sentinel.parse(certificate);
    if (valid_certificate) {
        log(chalk.bold.green("\nVALID CERTIFICATE RECORDED!\n"));
    } else {
        log(chalk.bold.red("\nINVALID CERTIFICATE ENCOUNTERED!\n"));
    }
    res.send('OK');
})

module.exports = router;
