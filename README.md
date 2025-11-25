![VeriGlyph: Verifiable, On-Chain Registration Certificates](https://github.com/VeriGlyph/media/blob/8ace91d004c913c5b13b4e5aaa45aab125653524/header.png)

# VeriGlyph: Sentinel

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Beta](https://placehold.co/100x28/6404fb/ffffff?text=BETA&font=roboto)
![Version: 2.0.0](https://placehold.co/100x28/170a40/ffffff?text=2.0.0&font=roboto)

Sentinel is the watcher and validator component of the VeriGlyph system to
support CIP-88/CIP-151 On-Chain Registration Certificates on the Cardano
blockchain.

## Requirements

- Docker Engine + Docker Compose Plugin (or Docker Desktop)
- (Optional) Node.js 20+ and npm if you want to run the API/frontend directly instead of via Docker
- A Blockfrost project ID for the target network (e.g., preprod/mainnet)

## Quick start (local, Docker)

1. Clone the repo and enter it:
   ```bash
   git clone https://github.com/veriglyph/sentinel.git
   cd sentinel
   ```
2. Create a `.env` with your Blockfrost credentials (example for preprod):
   ```bash
   cat > .env <<'EOF'
   BLOCKFROST_PROJECT_ID=your_blockfrost_project_id
   BLOCKFROST_NETWORK=preprod
   BLOCKFROST_START_HEIGHT=761976
   TRAEFIK_ENABLE_TLS=false
   EOF
   ```
   - Leave `TRAEFIK_ENABLE_TLS=false` for local HTTP on port 80. For HTTPS, set `TRAEFIK_ENABLE_TLS=true`, add `DOMAIN` and a real `LE_EMAIL`, and ensure the domain resolves to your machine.
3. Build and run everything:
   ```bash
   docker compose up --build
   ```
4. Open the frontend at `http://localhost` (or `https://<DOMAIN>` if TLS is enabled). The API is served under `/api` and `/certificates`.

## Notes

- Postgres data is stored in the `pgdata` named volume. Remove it with `docker volume rm sentinel_pgdata` if you need a clean DB.
- Services use `restart: unless-stopped` semantics if you add them to `docker-compose.yml`, or simply rerun `docker compose up -d` after a reboot.

