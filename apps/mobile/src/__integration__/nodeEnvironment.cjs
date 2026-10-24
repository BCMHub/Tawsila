const { TestEnvironment } = require('jest-environment-node');
// Capture Node's real transport outside Jest's React Native module mocks.
class IntegrationEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.integrationTransport = { fetch, Response, Request, Headers };
  }
}
module.exports = IntegrationEnvironment;
