require('dotenv').config();

const { Requester, Validator } = require('@chainlink/external-adapter');
const CustomAggregator = require('./CustomAggregator');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const minAnswers = process.env.MIN_ANSWERS || 1;
const timeoutMs = process.env.REQUESTS_TIMEOUT_MS || 1000;

const customParams = {
  from: ['from'],
  to: ['to'],
  endpoint: false
};

const createRequest = (input, endPointCallback) => {
  // console.log(input)
  const validator = new Validator(input, customParams);
  
  const jobRunID = validator.validated.id;
  const {from, to} = validator.validated.data;

  // Generate requests to each API
  const promises = CustomAggregator.apiSources.map((apiSource) => {
    const url = CustomAggregator.getUrl(apiSource, from, to);
    const path = CustomAggregator.getPath(apiSource, from, to);

    const controller = new AbortController();

    setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      signal: controller.signal
    })
    .then((response) => response.json())
    .then((response) => {
      const finalResponse = {
        data: {}
      };

      if(!Array.isArray(path[0])){
        finalResponse.data.result = Requester.validateResultNumber(response, path);
      }else{
        finalResponse.data.result = 0.5 * 
        (Requester.validateResultNumber(response, path[0]) + Requester.validateResultNumber(response, path[1]));
      }

      const result = Requester.success(jobRunID, finalResponse);
      // console.log('Received result', finalResponse.data.result, 'from', apiSource);
      
      return Promise.resolve({ result, apiSource });
    })
    .catch((error) => {
      console.log('Error from call to', apiSource, error.message);
      return Promise.reject({ error, apiSource });
    });
  });

  // Wait for all requests to be done and return the result
  return Promise.allSettled(promises)
    .then((responses) => {
      const fulfilledResponses = [];
      
      for(let responseIndex = 0; responseIndex < responses.length; responseIndex++) {
        const { status, value } = responses[responseIndex];
        
        if(status === 'fulfilled') {
          fulfilledResponses.push({
            apiSource: value.apiSource,
            value: value.result
          });
        }
      }

      // console.log(`Received ${fulfilledResponses.length} fulfilled responses.`);

      if (fulfilledResponses.length < minAnswers) {
        throw new Error(`Less than ${minAnswers} fulfilled responses.`);
      }

      const median = CustomAggregator.getMedian(fulfilledResponses.map(price => price.value.result));
      // console.log(`Calculated median: ${median}.`);
      endPointCallback(200, {
        jobRunID,
        data: {
          from,
          to,
          prices: fulfilledResponses,
          result: median.toString(),
        },
        statusCode: 200,
      });
      return median
    })
    .catch(error => {
      console.log('Error getting aggregated price', error)
      endPointCallback(500, Requester.errored(jobRunID, error));
    });
}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data);
  });
};

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data);
  });
};

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    });
  });
};

module.exports.createRequest = createRequest;