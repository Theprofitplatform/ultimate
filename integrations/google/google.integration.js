const { google } = require('googleapis');

class GoogleIntegration {
  constructor(auth) {
    this.auth = auth;
    this.services = {
      drive: google.drive({ version: 'v3', auth: this.auth }),
      sheets: google.sheets({ version: 'v4', auth: this.auth }),
      docs: google.docs({ version: 'v3', auth: this.auth })
    };
  }

  async getDriveFiles(folderId) {
    const response = await this.services.drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType)'
    });
    return response.data.files;
  }

  async readSheet(spreadsheetId, range) {
    const response = await this.services.sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    return response.data.values;
  }

  async updateSheet(spreadsheetId, range, values) {
    const response = await this.services.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
    return response.data;
  }
}

module.exports = GoogleIntegration;