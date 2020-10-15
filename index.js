require('dotenv').config();
const MQTT = require('mqtt');
const { GraphQLClient } = require('graphql-request');

const userMail = process.env.USERMAIL;
const userName = process.env.USERNAME;
const userPw = process.env.USERPW;
const backendLocation = process.env.BACKENDLOCATION;

var mqttClient = MQTT.connect(process.env.MQTTSERVERADDRESS, {
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
      // no login and signup possible...
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
  mqttClient.subscribe('mashing/#');
  mqttClient.subscribe('lautering/#');
  mqttClient.subscribe('boiling/#');
  mqttClient.subscribe('fermentation/#');
  mqttClient.subscribe('ispindel/#');

  console.log('Subscriptions done!');
}

mqttClient.on('message', function (topic, message) {
  let sensorName = topic.toString();
  let sensorValue = message.toString();
  let sensorTimeStamp = new Date().toJSON();

  let sensorData = {
    sensor_name: sensorName,
    sensor_time_stamp: sensorTimeStamp,
    sensor_value: sensorValue
  };
  try {
    const mutation = /* GraphQL */ `
      mutation addGraphData(
        $sensor_name: String!
        $sensor_time_stamp: DateTime!
        $sensor_value: String!
      ) {
        addGraphData(
          sensor_name: $sensor_name
          sensor_time_stamp: $sensor_time_stamp
          sensor_value: $sensor_value
        ) {
          id
        }
      }
    `;
    graphQLClient
      .request(mutation, sensorData)
      .then((data) =>
        console.log(
          'Stored data for ' + sensorName + 'with id: ' + data.addGraphData.id
        )
      )
      .catch((error) =>
        console.error(
          JSON.parse(JSON.stringify(error)).response.errors[0].message
        )
      );
  } catch (e) {
    console.log(e);
  }
});
