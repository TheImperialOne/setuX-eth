// export-wallets.js
const fs = require("fs");
const { Mnemonic, HDNodeWallet } = require("ethers");

const mnemonicPhrase = "laptop lend resist kid shell spider exchange middle skin distance link imitate"; // your Ganache mnemonic
const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);

const wallets = [];

for (let i = 0; i < 100; i++) {
  const path = `m/44'/60'/0'/0/${i}`;
  const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);
  wallets.push({
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
    used: false,
  });
}

fs.writeFileSync("wallets.json", JSON.stringify(wallets, null, 2));
console.log("✅ 100 wallets written to wallets.json");
