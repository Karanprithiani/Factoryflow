// Validate request data with a Zod schema. Parsed (and cleaned) values land in req.valid.
//   router.post('/', validate({ body: schema }), (req, res) => req.valid.body ...)
export const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  for (const part of ['body', 'params', 'query']) {
    if (schemas[part]) req.valid[part] = schemas[part].parse(req[part]);
  }
  next();
};
