const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('VeriGlyph: Sentinel Online');
});

module.exports = router;
