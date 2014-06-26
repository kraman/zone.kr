//require('../../lib/Setup.js').enable();
express = require('express');
var app = express();
var bodyParser = require('body-parser');
Error.stackTraceLimit = 0;

// app.use(function(req, res, next) {
//   zone.create(function RequestZone() {
//     zone.data.url = req.url;
//     next();
//   }).
//   catch (function(err) {
//     console.error(err);
//   });
// });

app.use(bodyParser());
var router = express.Router();

router.get('/', function(req, res) {
  res.json({
    // zone: zone.name,
    message: 'Hello world'
  });
});

app.use('/api', router);
app.listen(3001);

// ```
// Basic express  |  zones loaded  |  zone per req    || zones loaded (orig) | zone per req (orig)
//   2772 op/s    |   2444 op/s    |   2340 op/s      ||   1929 op/s         |   1666 op/s
//   0% slower    |   11.8% slower |   15.5 % slower  ||   30.4 % slower     |   40 % slower
// ```


1 - 5500
2 - 4400
3 - 4400