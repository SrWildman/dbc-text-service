const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const client = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const service = client.notify.services(process.env.TWILIO_NOTIFY_SERVICE_SID);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(pino);

app.get('/api/greeting', (req, res) => {
  const name = req.query.name || 'World';
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ greeting: `Hello ${name}!` }));
});

app.post('/api/messages', (req, res) => {
  res.header('Content-Type', 'application/json');
  numbers = req.body.to.split(',')
  const bindings = numbers.map(number => {
    return JSON.stringify({ binding_type: 'sms', address: number });
  });
  service.notifications
  .create({
        toBinding: bindings,
        body: req.body.body
  })
  .then(notification => {
        console.log(notification);
        res.send(JSON.stringify({ success: true }));
  })
  .catch(err => {
        console.error(err);
  });
});

app.listen(3001, () =>
  console.log('Express server is running on localhost:3001')
);
