require('dotenv').config()
const Web3 = require('web3')
const { sha3 } = require('web3-utils')
const fetch = require('node-fetch')
const fs = require('fs')
const ORACLE_ABI = require('./oracle.abi.json')
const Web3Utils = require('web3-utils')
const { hexToUtf8 } = require('web3-utils');

const FAKE_RESPONSE = "0x000000000000000000000000000000000000000000000000000000c2797eab80"

const {
  ORACLE_ADDRESS,
  START_BLOCK,
  NODE_ADDRESS,
  RPC_URL,
  BLOCK_INTERVAL
} = process.env

let END_BLOCK = process.env.END_BLOCK;

const web3 = new Web3(RPC_URL)
const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS)

async function getOracleRequestEvents(fromBlock, toBlock) {
  const body = {
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [{
      fromBlock,
      toBlock,
      "topics": [
        "0xd8d7ecc4800d25fa53ce0372f13a416d98907a7ef3d8d3bdd79cf4fe75529c65",
      ]
    }],
    "id": 74
  }
  const response = await fetch(RPC_URL, {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9,ru;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "pragma": "no-cache"
    }
  })

  const { result } = await response.json()
  const events = []
  result.forEach(event => {
    const data = web3.eth.abi.decodeLog([{ type: 'address', name: 'requester' }, { type: 'bytes32', name: 'requestId', }, { type: 'uint256', name: 'payment', }, { type: 'address', name: 'callbackAddr', }, { type: 'bytes4', name: 'callbackFunctionId', }, { type: 'uint256', name: 'cancelExpiration', }, { type: 'uint256', name: 'dataVersion', }, { type: 'bytes', name: 'data', }],
      event.data,
      event.topics);
    data.transactionHash = event.transactionHash
    data.blockNumber = event.blockNumber
    data.jobId = event.topics[1]
    // console.log(data.jobId)
    events.push(data)
  })
  return events
}

async function isFulfilledRequest(requestId) {
  const mappingPosition = '0'.repeat(63) + '2'
  const key = sha3(requestId + mappingPosition, { encoding: 'hex' })
  const body = {
    "jsonrpc": "2.0",
    "method": "eth_getStorageAt",
    "params": [
      ORACLE_ADDRESS,
      key,
      "latest"
    ],
    "id": 74
  }
  const response = await fetch(RPC_URL, {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9,ru;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "pragma": "no-cache"
    }
  })

  const { result } = await response.json()

  return result === '0x0000000000000000000000000000000000000000000000000000000000000000'
}

async function findRequests() {
  const step = Number(BLOCK_INTERVAL)
  let from
  let to
  const startBlock = Number(START_BLOCK || process.env.START_BLOCK)
  let endBlock = END_BLOCK
  if (endBlock === 'latest') {
    endBlock = await web3.eth.getBlockNumber()
  }
  const totalBlocks = endBlock - startBlock

  let processedBlocks = 0
  for (let i = startBlock; i < endBlock; i += step) {
    from = Web3Utils.toHex(i)
    to = '0x' + (Number(from) + step).toString(16)
    const percentage = (processedBlocks / totalBlocks) * 100
    console.log(`Processing blocks: ${i}-${Number(to)} | Progress: ${(i - START_BLOCK)}/${(endBlock - START_BLOCK)} (${percentage.toFixed(3)}%)`)
    const requestEvents = await getOracleRequestEvents(from, to)
    if (requestEvents.length > 0) {
      console.log(`We got ${requestEvents.length} request events. Start processing...`)
      for (let requestEvent of requestEvents) {
        const isFulfilled = await isFulfilledRequest(requestEvent.requestId)
        if (!isFulfilled) {
          console.log(`Request without fulfillment found for job: ${hexToUtf8(requestEvent.jobId)}! Blocknumber is ` + Number(requestEvent.blockNumber))
          const { requestId, payment, callbackAddr, callbackFunctionId, cancelExpiration, jobId } = requestEvent
          const data = FAKE_RESPONSE
          const tx = [requestId, payment, callbackAddr, callbackFunctionId, cancelExpiration, data]
          const succesfullFulfill = await oracle.methods.fulfillOracleRequest(...tx).call({
            from: NODE_ADDRESS
          })
          if (succesfullFulfill) {
            let writeData = tx
            writeData["jobId"] = jobId 
            await fs.appendFile(`./storage/unfullfilled_requests`, JSON.stringify(writeData) + ',\n', () => { })
          } else {
            console.log('Something wrong with this request, we cannot fulfill it', requestEvent)
          }
        }
      }
    }
    processedBlocks++
  }
}

findRequests();
