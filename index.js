const MQTT = require('mqtt');
const { GraphQLClient } = require('graphql-request');

const userMail = 'InputUser';
const userName = 'InputUser';
const userPw = 'Ewi_g9fTD}Nr%Xj@';
const backendAppSecret = 'wZL_my[iy3Z8XNd';
const backendLocation = 'http://localhost:4000';

var mqttClient = MQTT.connect('tcp://localhost:1883', {
  clientId: 'braustube-device'
});

var graphQLClient = new GraphQLClient(backendLocation);

mqttClient.on('connect', main);

async function main() {
  console.log('Register or login user...');
  let data;
  let token;
  let mutation = /* GraphQL */ `
    mutation login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        token
      }
    }
  `;
  let variables = {
    email: userMail,
    password: userPw
  };
  try {
    data = await graphQLClient.request(mutation, variables);
    token = data.login.token;
    console.log('Received token: ' + token);
  } catch (e) {
    console.log('Login not possible, trying to register new user...');

    mutation = /* GraphQL */ `
      mutation signup(
        $name: String!
        $password: String!
        $email: String!
        $registrationSecret: String!
      ) {
        signup(
          name: $name
          password: $password
          email: $email
          registrationSecret: $registrationSecret
        ) {
          token
        }
      }
    `;
    variables = {
      name: userName,
      password: userPw,
      email: userMail,
      registrationSecret: backendAppSecret
    };
    try {
      data = await graphQLClient.request(mutation, variables);
      token = data.signup.token;
      console.log('Received token: ' + token);
    } catch (e) {
      // No login and signup possible...
      console.log(e);
      process.exit(1);
    }
  }

  // update client variable
  graphQLClient = new GraphQLClient(backendLocation, {
    headers: {
      Authorization: 'Bearer ' + token
    }
  });
  console.log('Starting');

  // now we subscribe to all topics we want to put into the database
  // TODO
  mqttClient.subscribe('fermenter1/temperature/');

  console.log('Done');
}
mqttClient.on('message', function(topic, message) {
  process(JSON.parse(message.toString()));
});

async function process(message) {
  let sensorName = message.sensorName;
  let sensorValue = message.sensorValue;
  let sensorTimeStamp = message.sensorTimeStamp;
  let sensorData = {
    sensorName: sensorName,
    sensorTimeStamp: sensorTimeStamp,
    sensorValue: sensorValue
  };
  sensorData = { sensorData: sensorData };
  try {
    const mutation = /* GraphQL */ `
      mutation addData($sensorData: SensorDataInput!) {
        addData(sensorData: $sensorData) {
          id
        }
      }
    `;
    graphQLClient.request(mutation, sensorData).then(data => console.log(data));
  } catch (e) {
    console.log(e);
  }
}
