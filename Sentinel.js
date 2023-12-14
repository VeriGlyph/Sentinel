const CSL = require('@emurgo/cardano-serialization-lib-nodejs');
const cbor = require('cbor');
const utils = require('./utils');
const chalk = require('chalk');

const log = console.log;

class Sentinel {

    parse(certificate) {
        log("Sentinel parsing...");
        const version = certificate[0] || 0;
        const data = certificate[1] || null;
        const witnesses = certificate[2] || null;

        if (data === null || witnesses === null) {
            return false;
        }

        switch (version) {
            case 1:
                return this.parseV1(data, witnesses);
        }


    }

    parseV1(data, witnesses) {
        log("Parsing " + chalk.bold.white("Version 1") + " Certificate");
        const mapped_data = utils.jsToCbor(data);
        const cbor_data = cbor.encode(mapped_data);

        if (mapped_data.get(1)[0] === 0) {
            log("Validating " + chalk.bold.white("Native Script") + " context!");
            const policy_id = Buffer.from(mapped_data.get(1)[1]).toString("hex");
            log("Parsing certificate for Policy ID:", chalk.bold.white(policy_id));
            const policy_hex = mapped_data.get(1)[2].reduce(
                (hex_data, value) => hex_data + Buffer.from(value).toString("hex"),
                ""
            );

            const NativeScript = CSL.NativeScript.from_hex(policy_hex);

            if (NativeScript.hash().to_hex() !== policy_id) {
                log(chalk.bold.red("✗"),"The value of the decoded script " + chalk.bold.white("DOES NOT MATCH") + " the specified policy ID!");
                return false;
            } else {
                console.info(chalk.bold.green("✓"),"The value of the decoded script " + chalk.bold.white("MATCHES") + " the specified policy ID!");
            }

            let valid_witness = false;
            for (let i = 0; i < witnesses.length; i++) {
                const witness = witnesses[i];

                const PublicKey = CSL.PublicKey.from_hex(witness[0]);
                const PubKeyHash = PublicKey.hash().to_hex();

                if (NativeScript.get_required_signers().to_js_value().includes(PubKeyHash)) {
                    log(chalk.bold.green("✓"),"The witness public key " + chalk.bold.white("WAS FOUND") + " in the script!");
                    valid_witness = true;
                } else {
                    log(chalk.bold.red("✗"),"The witness public key " + chalk.bold.white("WAS NOT FOUND") + " in the script!");
                }

                const IsValid = PublicKey.verify(cbor_data, CSL.Ed25519Signature.from_hex(witness[1]));

                if (IsValid) {
                    log(chalk.bold.green("✓"),"The provided signature " + chalk.bold.white("IS VALID") + " for this certificate!");
                } else {
                    log(chalk.bold.red("✗"),"The provided signature " + chalk.bold.white("IS NOT VALID") + " for this certificate!");
                    return false;
                }
            }

            if (!valid_witness) {
                log(chalk.bold.red("✗"),"A valid witness "+chalk.bold.white("WAS NOT FOUND")+" in the certificate!");
                return false;
            }

            return true;
        }
    }

}

module.exports = Sentinel;