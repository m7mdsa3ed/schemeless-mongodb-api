const BaseEmailProvider = require('./baseEmailProvider');

class ApiProvider extends BaseEmailProvider {
  constructor(config) {
    super();
    this.config = config;
    this.client = this.initializeClient();
  }

  initializeClient() {
    if (this.config.type === 'mailgun') {
      return this.initializeMailgunClient();
    }
    throw new Error(`Unsupported API provider type: ${this.config.type}`);
  }

  initializeMailgunClient() {
    const mailgun = require('mailgun-js');
    return mailgun({
      apiKey: this.config.apiKey,
      domain: this.config.domain,
    });
  }

  async send(to, subject, text, html = null, options = {}) {
    try {
      const data = {
        from: this.config.from,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        text,
        html: html || text,
        ...options,
      };

      const result = await this.client.messages().send(data);
      return {
        success: true,
        messageId: result.id,
        provider: 'api',
        providerType: this.config.type,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: 'api',
        providerType: this.config.type,
      };
    }
  }

  async validateConnection() {
    try {
      await this.client.get('/domains');
      return {
        success: true,
        message: `${this.config.type} API connection verified`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = ApiProvider;