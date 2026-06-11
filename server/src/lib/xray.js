import AWSXRay from 'aws-xray-sdk';
import http from 'http';
import https from 'https';

// Capture all outgoing HTTP and HTTPS requests automatically
AWSXRay.captureHTTPsGlobal(http);
AWSXRay.captureHTTPsGlobal(https);

export const xrayMiddleware = AWSXRay.express.openSegment('admateine-leads-api');
export const xrayCloseMiddleware = AWSXRay.express.closeSegment();

export default {
  xrayMiddleware,
  xrayCloseMiddleware,
};
