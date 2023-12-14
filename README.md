![VeriGlyph: Verifiable, On-Chain Registration Certificates](https://github.com/VeriGlyph/media/blob/8ace91d004c913c5b13b4e5aaa45aab125653524/header.png)

# VeriGlyph: Sentinel

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Alpha](https://placehold.co/100x28/6404fb/ffffff?text=ALPHA&font=roboto)
![Version: 0.0.1](https://placehold.co/100x28/170a40/ffffff?text=0.0.1&font=roboto)


Sentinel is the watcher and validator component of the VeriGlyph system to support CIP-88 On-Chain Registration 
Certificates on the Cardano blockchain.

## Requirements

The following list of requirements are based on testing of Sentinel in its current configuration. Your results may vary
if you choose to run using different versions than those specified.

* [Oura: ^1.8.3](https://github.com/txpipe/oura/releases)
* [Node: ^18.19.0](https://nodejs.org/en)

## Installation

To begin, ensure that your operating system has a functional version of Oura and Node.js installed and then clone this
repository to your local system. Running the various components (Oura, Sentinel) as services or via a terminal session
management software like `tmux` is advised to keep processes running in the background.

Oura should be operated in `daemon` mode to continuously monitor the blockchain for new registrations. A working
configuration for Cardano's `preproduction` testnet has been provided in [oura.preprod.toml](./oura.preprod.toml).

If you wish to run Sentinel continuously even during development you can install `nodemon` globally on your system by
running:

```shell
npm install -g nodemon
```

Once the aforementioned prerequisites are completed, you're ready to begin running Sentinel.

### 1. Install NPM packages
```shell
npm install
```

### 2. Start Sentinel
```shell
npm run serve
```

### 3. Start Oura
```shell
./oura daemon --config oura.preprod.toml
```