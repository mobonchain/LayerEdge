import fs from "fs/promises";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Wallet } from "ethers";
import banner from "./src/banner.js";
import logger from "./src/logger.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms * 1000));

async function readFileLines(path) {
    try {
        const data = await fs.readFile(path, "utf8");
        return data.split("\n").map(line => line.trim()).filter(Boolean);
    } catch (error) {
        logger.error(`Failed to read file: ${path}`, '', error);
        return [];
    }
}

const newAgent = (proxy) => {
    if (!proxy) return null;
    return proxy.startsWith("http") ? new HttpsProxyAgent(proxy) : new SocksProxyAgent(proxy);
};

class RequestHandler {
    static async makeRequest(config, retries = 30, backoffMs = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                logger.verbose(`Attempt ${i + 1}/${retries}: ${config.url}`);
                const response = await axios(config);
                logger.verbose(`Request successful - Status ${response.status}`);
                return response;
            } catch (error) {
                if (i === retries - 1) {
                    logger.error("Request failed after multiple attempts", '', error);
                    return null;
                }
                if (error.response?.status === 500) {
                    logger.warn(`Server error (500), retrying in ${backoffMs / 1000}s`);
                    await delay(backoffMs / 1000);
                    continue;
                }
                logger.warn("Request failed, retrying in 2s", '', error);
                await delay(2);
            }
        }
        return null;
    }
}

class LayerEdgeConnection {
    constructor(proxy = null, privateKey = null, refCode = "knYyWnsE") {
        this.refCode = refCode;
        this.proxy = proxy;
        this.wallet = privateKey ? new Wallet(privateKey) : Wallet.createRandom();

        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Origin": "https://layeredge.io",
            "Referer": "https://layeredge.io/",
        };

        this.axiosConfig = {
            ...(proxy && { httpsAgent: newAgent(proxy) }),
            timeout: 60000,
            headers: this.headers,
        };

        logger.verbose(`Initialized - Wallet: ${this.wallet.address}, Proxy: ${proxy || "None"}`);
    }

    async makeRequest(method, url, config = {}) {
        return await RequestHandler.makeRequest({
            method,
            url,
            ...this.axiosConfig,
            ...config,
            headers: { ...this.headers, ...(config.headers || {}) },
        });
    }

    async checkNodeStatus() {
        const response = await this.makeRequest("get", `https://referralapi.layeredge.io/api/light-node/node-status/${this.wallet.address}`);
        return response?.data?.data?.startTimestamp ? true : false;
    }

    async connectNode() {
        const timestamp = Date.now();
        const message = `Node activation request for ${this.wallet.address} at ${timestamp}`;
        const sign = await this.wallet.signMessage(message);

        const response = await this.makeRequest("post", `https://referralapi.layeredge.io/api/light-node/node-action/${this.wallet.address}/start`, {
            data: { sign, timestamp },
            headers: { "Content-Type": "application/json" },
        });

        return response?.data?.message === "node action executed successfully";
    }
}

async function run() {
    console.log(banner);
    logger.info("LayerEdge Auto Bot started", "Initializing...");

    try {
        const proxies = await readFileLines("proxy.txt");
        const walletsData = await fs.readFile("wallets.json", "utf-8");
        const wallets = JSON.parse(walletsData);

        if (!wallets.length) throw new Error("No wallets found");
        logger.info(`Loaded ${wallets.length} wallets & ${proxies.length} proxies`);

        while (true) {
            for (const [i, { address, privateKey }] of wallets.entries()) {
                const proxy = proxies[i % proxies.length] || null;
                const bot = new LayerEdgeConnection(proxy, privateKey);

                logger.info(`Processing wallet: ${address}`);
                if (await bot.checkNodeStatus()) {
                    logger.success("Node is already active, skipping...");
                } else {
                    logger.info("Activating node...");
                    await bot.connectNode();
                }
            }
            logger.warn("Cycle completed - Pausing for 1 hour...");
            await delay(3600);
        }
    } catch (error) {
        logger.error("Critical error encountered", '', error);
        process.exit(1);
    }
}

run();
