require('dotenv').config()
const Web3 = require('web3')
const { numberToHex, toHex, toWei } = require('web3-utils')
const fs = require('fs')
const ORACLE_ABI = require('./oracle.abi.json')
const createLogger = require('./utils/createLogger');
const logger = createLogger("fulfill-missing-requests");

const {
  ORACLE_ADDRESS,
  PRIVATE_KEY,
  RPC_URL,
  GAS_TOKEN
} = process.env

const web3 = new Web3(RPC_URL, null, { transactionConfirmationBlocks: 1 })
const account = web3.eth.accounts.privateKeyToAccount('0x' + PRIVATE_KEY)
web3.eth.accounts.wallet.add('0x' + PRIVATE_KEY)
web3.eth.defaultAccount = account.address
const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS)

async function main() {
  const createRequest = require('./utils/priceData/index').createRequest
  linkPrice = await createRequest({ "data": { "from": "link", "to": "usd" } }, (status, result) => {
    const price = result.data.result
    return price
  })
  gasTokenPrice = await createRequest({ "data": { "from": GAS_TOKEN, "to": "usd" } }, (status, result) => {
    const price = result.data.result
    return price
  })
  logger.log(`Current LINK price: $${linkPrice}`)
  logger.log(`Current ${GAS_TOKEN} price: $${gasTokenPrice}`)
  const fileContent = fs.readFileSync('./storage/unfulfilled_requests', 'utf8');
  const lines = fileContent.split('\n').filter(Boolean);
  const txs = lines.map(line => JSON.parse(line.trim().slice(0, -1)));
  let gas
  gas = await oracle.methods.fulfillOracleRequest(...txs[0]).estimateGas();

  for (let i = 0; i < txs.length; i++) {
    const args = txs[i];
    const data = oracle.methods.fulfillOracleRequest(...args).encodeABI();

    try {
      let gasPrice, paymentTx
      if (i % 25 == 0) {
        gasPrice = await web3.eth.getGasPrice();
      }
      paymentTx = ((args[1] / 10 ** 18) * linkPrice)
      costTx = (((gas * gasPrice) / 10 ** 18) * gasTokenPrice)
      logger.log("Payment: $" + paymentTx + " | Cost: $" + costTx)
      if (costTx > paymentTx) {
        logger.log(`Won't fulfill the request because it's unprofitable. Saving to file.`)
        // save to unprofitable_requests
        const unprofitableContent = JSON.stringify(args) + ',\n';
        fs.appendFileSync('./storage/unprofitable_requests', unprofitableContent);
        continue;
      }

      let nonce = await web3.eth.getTransactionCount(account.address);
      gasPrice = await web3.eth.getGasPrice();
      logger.log('Fulfilling request using nonce:', nonce);
      const tx = {
        from: web3.eth.defaultAccount,
        value: '0x00',
        gas: numberToHex(gas),
        gasPrice: toHex((gasPrice*1.1)),
        to: oracle._address,
        netId: 1,
        data,
        nonce
      };

      let signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
      let result;
      logger.log(`Sent tx with hash: ${signedTx.transactionHash}, waiting for confirmation...`)
      try {
        let result = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        logger.log(`A new successfully sent tx ${result.transactionHash}`);
        nonce++;
      } catch (e) {
        console.error('skipping tx', txs[i], e);
      }
    } catch (e) {
      console.error('skipping tx', txs[i], e);
      continue;
    }
  }
}


main()
