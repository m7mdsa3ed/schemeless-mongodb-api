const nodemailer = require('nodemailer');
const BaseEmailProvider = require('./baseEmailProvider');

class SmtpProvider extends BaseEmailProvider {
  constructor(config) {
    super();
    this.config = config;
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure || false,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      tls: {
        rejectUnauthorized: this.config.rejectUnauthorized || true,
      },
    });
  }

  async send(to, subject, text, html = null, options = {}) {
    try {
      const mailOptions = {
        from: this.config.from,
        to,
        subject,
        text,
        html: html || text,
        ...options,
      };

      const result = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: result.messageId,
        provider: 'smtp',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: 'smtp',
      };
    }
  }

  async validateConnection() {
    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'SMTP connection verified',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = SmtpProvider;