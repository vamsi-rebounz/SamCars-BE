
const formidable = require('formidable');

const parseFormData = (req, res, next) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(400).json({ message: 'Error parsing form-data', error: err });
    }
    req.body = fields;
    req.files = files;
    next();
  });
};

module.exports = parseFormData;
