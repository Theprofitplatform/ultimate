class KeywordsController {
  async handle(data, user) {
    // Implementation
    return { message: 'Keywords endpoint', data, userId: user.id };
  }
}

module.exports = { KeywordsController: new KeywordsController() };