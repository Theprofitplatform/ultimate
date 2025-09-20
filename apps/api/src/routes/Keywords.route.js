const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { KeywordsController } = require('../controllers/Keywords');

router.get(
  '/api/keywords',
  authMiddleware,
  validateRequest,
  async (req, res, next) => {
    try {
      const result = await KeywordsController.handle(req.body, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;