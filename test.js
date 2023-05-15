const { hexToUtf8 } = require('web3-utils');

const hexString = "0x3430623930323466393363393430326238353736633533636638643938653763";
const originalString = hexToUtf8(hexString);

console.log(originalString);
