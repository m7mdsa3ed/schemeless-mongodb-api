class BaseEmailProvider {
  async send(to, subject, text, html = null, options = {}) {
    throw new Error('send method must be implemented by subclass');
  }

  async validateConnection() {
    throw new Error('validateConnection method must be implemented by subclass');
  }
}

module.exports = BaseEmailProvider;