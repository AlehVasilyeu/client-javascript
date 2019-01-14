/* eslint-disable no-console */
const RPClient = require('../lib/report-portal-client.js');
const config = require('./client.conf');

const rpClient = new RPClient(config);

rpClient.checkConnect().then((response) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${response.full_name}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
