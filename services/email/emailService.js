const SmtpProvider = require('./smtpProvider');
const ApiProvider = require('./apiProvider');
const config = require('../../config');

class EmailService {
  constructor() {
    this.provider = null;
    this.initializeProvider();
  }

  initializeProvider() {
    const emailConfig = config.email;

    switch (emailConfig.provider) {
      case 'smtp':
        this.provider = new SmtpProvider(emailConfig.smtp);
        break;
      case 'api':
        this.provider = new ApiProvider(emailConfig.api);
        break;
      default:
        throw new Error(`Unsupported email provider: ${emailConfig.provider}`);
    }
  }

  async send(to, subject, text, html = null, options = {}) {
    if (!this.provider) {
      throw new Error('Email provider not initialized');
    }

    try {
      const result = await this.provider.send(to, subject, text, html, options);

      if (!result.success) {
        console.error('Email sending failed:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Email service error:', error);
      return {
        success: false,
        error: error.message,
        provider: config.email.provider,
      };
    }
  }

  async validateConnection() {
    if (!this.provider) {
      return {
        success: false,
        error: 'Email provider not initialized',
      };
    }

    return await this.provider.validateConnection();
  }

  async sendBulk(recipients, subject, text, html = null, options = {}) {
    const results = [];

    for (const recipient of recipients) {
      const result = await this.send(recipient, subject, text, html, options);
      results.push({
        recipient,
        ...result,
      });
    }

    return results;
  }
}

module.exports = new EmailService();