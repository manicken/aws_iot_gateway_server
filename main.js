// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
var awsIot = require('aws-iot-device-sdk');
const net = require('net');
const port = 3000;
const host = '192.168.50.216';

const fs = require('fs');

function readFile(path) {
try {
  // Read the file synchronously
  const fileContents = fs.readFileSync(path, 'utf-8');
  return fileContents;
} catch (error) {
  // Handle errors, e.g., file not found
  console.error('Error reading file:', error.message);
  return "";
}

}

// uid = "3AD4FF6"
function RF433_SLC_to_json(msg) {
    let uid = msg.substring(0,7); console.log("RF433_SLC_to_json uid:" + uid);
    msg = msg.substring(8); console.log("RF433_SLC_to_json rest:" + msg);
    return { "cmd": "RF433", "type":"slc", "uid":uid, "grp_btn":msg[0], "state":msg[1], "btn":msg[2]};
}
function RF433_ALC_to_json(msg) { 
    return { "cmd": "RF433", "type":"alc", "raw":msg };
}
function RF433_SFC_to_json(msg) { 
    return { "cmd": "RF433", "type":"sfc", "ch":msg[0], "btn":msg[1], "state":msg[2]};
}
function RF433_AFC_to_json(msg) { 
    return { "cmd": "RF433", "type":"afc", "ch":msg[0], "btn":msg[1], "state":msg[2]};
}

let mqttTarget = 'db_kitchen_env/sub';

function parseTcpServerMessage(msg)
{
	if (msg.startsWith("sed")) // send environment data
    {
		console.log("send environent data decoded");
	}
	else if (msg.startsWith("433"))
    {
		msg = msg.substring(3);
        console.log("433 decoded:" + msg);
        if (msg.startsWith("sfc")) // simple fixed code
        {
            msg = msg.substring(3);
            if (msg.length < 3) return;
            let jsonStr = JSON.stringify(RF433_SFC_to_json(msg));
            console.log("publish: " + jsonStr);
            device.publish(mqttTarget, jsonStr);
        }
        else if (msg.startsWith("afc")) // advanced fixed code
        {
            msg = msg.substring(3);
            if (msg.length < 3) return;
            let jsonStr = JSON.stringify(RF433_AFC_to_json(msg));
            console.log("publish: " + jsonStr);
            device.publish(mqttTarget, jsonStr);
        }
        else if (msg.startsWith("slc")) // simple learning code
        {
            msg = msg.substring(3);
            if (msg.length < 11) return;
            let jsonStr = JSON.stringify(RF433_SLC_to_json(msg));
            console.log("publish: " + jsonStr);
            device.publish(mqttTarget, jsonStr);
        }
        else if (msg.startsWith("alc")) // advanced learning code
        {
            msg = msg.substring(3);
            if (msg.length < 8) return;
            let jsonStr = JSON.stringify(RF433_ALC_to_json(msg));
            console.log("publish: " + jsonStr);
            device.publish(mqttTarget, jsonStr);
        }
        //testMessage.state = msg;
	    //device.publish('db_kitchen_env/sub', JSON.stringify(testMessage));
	}
	
	
}


const server = net.createServer();
server.listen(port, host, () => {
    console.log('TCP Server is running on port ' + port + '.');
});

let sockets = [];

server.on('connection', function(sock) {
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
    sockets.push(sock);

    sock.on('data', function(data) {
        console.log('DATA ' + sock.remoteAddress + ': ' + data);
		
		// TODO: add functionality so that strings can be intercepted here
		parseTcpServerMessage(data.toString());
		
		
		
        // Write the data back to all the connected, the client will receive it as data from the server
		/*sockets.forEach(function(sock, index, array) {
            sock.write(sock.remoteAddress + ':' + sock.remotePort + " said " + data + '\n');
        });*/
    });

    // Add a 'close' event handler to this instance of socket
    sock.on('close', function(data) {
        let index = sockets.findIndex(function(o) {
            return o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort;
        })
        if (index !== -1) sockets.splice(index, 1);
        console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });
    sock.on('end', function(data) {
        let index = sockets.findIndex(function(o) {
            return o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort;
        })
        if (index !== -1) sockets.splice(index, 1);
        console.log('ENDED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });
    // Handle 'error' event
    sock.on('error', (err) => {
        console.error(`Socket error: ${err.message}`);
        // Handle the error gracefully, if possible
        let index = sockets.findIndex(function(o) {
            return o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort;
        })
        if (index !== -1) sockets.splice(index, 1);
  });

});

// Event: 'error' - Emitted when an error occurs
server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
  });

//
// Replace the values of '<YourUniqueClientIdentifier>' and '<YourCustomEndpoint>'
// with a unique client identifier and custom host endpoint provided in AWS IoT.
// NOTE: client identifiers must be unique within your AWS account; if a client attempts
// to connect with a client identifier which is already in use, the existing
// connection will be terminated.
//
var device = awsIot.device({
   keyPath: "secrets/private.key",
  certPath: "secrets/device.crt",
    caPath: "secrets/AmazonRootCA1.pem",
  clientId: "gateway_server",
      host: readFile("secrets/mqtt_endpoint_host.txt")
});





//
// Device is an instance returned by mqtt.Client(), see mqtt.js for full
// documentation.
//
device
  .on('connect', function() {
    console.log('connect');
    device.subscribe('db_kitchen_env/pub');
    device.publish('db_kitchen_env/sub', JSON.stringify({"cmd":"sendEnvData"}));
  });

device
  .on('message', function(topic, payload) {
    console.log('message', topic, payload.toString());
	sockets.forEach(function(sock, index, array) {
        sock.write("log " + payload.toString());//sock.remoteAddress + ':' + sock.remotePort + " said " + data + '\n');
    });
  });

// Handle 'error' event
device.on('error', (err) => {
    console.error(`Device client error: ${err.message}`);
    // Handle the error gracefully, if possible
  });
