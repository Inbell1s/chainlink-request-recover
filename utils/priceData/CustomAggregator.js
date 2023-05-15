const API_REF = {
  huobi: {
    getUri: (from, to) => {
      const api = 'https://api.huobi.pro/market/trade';
      const url = `${api}?symbol=${from.toLowerCase()}${to.toLowerCase()}t`;

      return url;
    },
    getPath: (from, to) => {
      return ['tick', 'data', '0', 'price'];
    }
  },
  binance: {
    getUri: (from, to) => {
      const api = 'https://api.binance.com/api/v1/ticker/price';
      const url = `${api}?symbol=${from.toUpperCase()}${to.toUpperCase()}T`;

      return url;
    },
    getPath: (from, to) => {
      return ['price'];
    }
  },
  /*gateio: {
    getUri: (from, to) => {
      const api = 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=';
      const url = `${api}${from.toUpperCase()}_${to.toUpperCase()}T`;

      return url;
    },
    getPath: (from, to) => {
      return ['0','last'];
    }
  },*/
  coinbase: {
    getUri: (from, to) => {
      const api = 'https://api.exchange.coinbase.com/products/';
      const url = `${api}/${from.toLowerCase()}-${to.toLowerCase()}/ticker`;

      return url;
    },
    getPath: (from, to) => {
      return ['price'];
    }
  },
  okex: {
    getUri: (from, to) => {
      const api = 'https://www.okex.com/api/v5/market/ticker?instId=';
      const url = `${api}${from.toUpperCase()}-${to.toUpperCase()}T`;

      return url;
    },
    getPath: (from, to) => {
      return ['data','0','last'];
    }
  },
  bybit: {
    getUri: (from, to) => {
      const api = 'https://api.bybit.com/spot/v3/public/quote/ticker/price?symbol=';
      const url = `${api}${from.toUpperCase()}${to.toUpperCase()}T`;

      return url;
    },
    getPath: (from, to) => {
      return ['result', 'price'];
    }
  },
  kucoin: {
    getUri: (from, to) => {
      const api = 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=';
      const url = `${api}${from.toUpperCase()}-${to.toUpperCase()}T`;

      return url;
    },
    getPath: (from, to) => {
      return ['data','price'];
    }
  }
};

class CustomAggregator {
  static apiSources = Object.keys(API_REF);

  static getUrl(source, from, to) {
    return API_REF[source].getUri(from, to);
  };

  static getPath(source, from, to) {
    return API_REF[source].getPath(from, to);
  };

  static getMedian(values) {
    const mid = Math.floor(values.length / 2);
    values.sort((a, b) => a - b);
    return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  }
};

module.exports = CustomAggregator;