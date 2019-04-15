const MQTT = require('mqtt');
const { GraphQLClient } = require('graphql-request');

const userMail = 'InputUser';
const userName = 'InputUser';
const userPw = 'Ewi_g9fTD}Nr%Xj@';
const backendLocation = 'https://indebrau-backend.herokuapp.com';

var mqttClient = MQTT.connect('tcp://localhost:1883', {
  clientId: 'braustube-mqttProxy'
});

var graphQLClient = new GraphQLClient(backendLocation);

mqttClient.on('connect', main);

async function main() {
  console.log('Register or login user...');
  let data;
  let token;
  let mutation = /* GraphQL */ `
    mutation signin($email: String!, $password: String!) {
      signin(email: $email, password: $password) {
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
    token = data.signin.token;
    console.log('Received token: ' + token);
  } catch (e) {
    console.log('Login not possible, trying to register new user...');

    mutation = /* GraphQL */ `
      mutation signup($name: String!, $password: String!, $email: String!) {
        signup(name: $name, password: $password, email: $email) {
          token
        }
      }
    `;
    variables = {
      name: userName,
      password: userPw,
      email: userMail
    };
    try {
      data = await graphQLClient.request(mutation, variables);
      token = data.signup.token;
      console.log('Received token: ' + token);
    } catch (e) {
      // No login and signup possible...
      console.error(e);
      process.exit(1);
    }
  }

  // update client variable
  graphQLClient = new GraphQLClient(backendLocation, {
    headers: {
      Authorization: 'Bearer ' + token
    }
  });
  console.log('Starting...');

  // now we subscribe to all topics
  // we want to sent to the backend server
  mqttClient.subscribe('fermentation/fridge/temperature');
  mqttClient.subscribe('fermentation/fridge/heating');
  mqttClient.subscribe('fermentation/fridge/cooling');
  mqttClient.subscribe('fermentation/freezer/temperature');
  mqttClient.subscribe('fermentation/freezer/heating');
  mqttClient.subscribe('fermentation/freezer/cooling');
  mqttClient.subscribe('boiling/wortCopper/temperature');
  mqttClient.subscribe('boiling/wortCopper/heating');
  mqttClient.subscribe('boiling/pump/power');
  mqttClient.subscribe('mashing/mashTun/temperature');
  mqttClient.subscribe('mashing/mashTun/heating');
  mqttClient.subscribe('mashing/agitator/power');
  mqttClient.subscribe('ispindel/iSpindel1/gravity');
  mqttClient.subscribe('ispindel/iSpindel1/tilt');
  mqttClient.subscribe('ispindel/iSpindel1/temperature');
  mqttClient.subscribe('ispindel/iSpindel2/gravity');
  mqttClient.subscribe('ispindel/iSpindel2/temperature');
  mqttClient.subscribe('ispindel/iSpindel2/tilt');
  console.log('Subscriptions done!');
}

mqttClient.on('message', function(topic, message) {
  let sensorName = topic.toString();
  let sensorValue = message.toString();
  let sensorTimeStamp = new Date().toJSON();

  let sensorData = {
    sensorName: sensorName,
    sensorTimeStamp: sensorTimeStamp,
    sensorValue: sensorValue
  };
  try {
    const mutation = /* GraphQL */ `
      mutation addGraphData(
        $sensorName: String!
        $sensorTimeStamp: DateTime!
        $sensorValue: String!
      ) {
        addGraphData(
          sensorName: $sensorName
          sensorTimeStamp: $sensorTimeStamp
          sensorValue: $sensorValue
        ) {
          id
        }
      }
    `;
    graphQLClient.request(mutation, sensorData).then(data => console.log(data)).catch(error => console.error(JSON.parse(JSON.stringify(error)).response.errors));
  } catch (e) {
    console.log(e);
  }
});
