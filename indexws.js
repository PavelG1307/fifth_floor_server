
const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const Datastore = require('nedb');

let datajs;
const db = new Datastore({filename : 'db'});
db.loadDatabase();



const port = 8080;
const wsServer = new WebSocket.Server({port: port});
const clients = {}

wsServer.on('connection', onConnect);

function onConnect(wsClient) {
    console.log("New client");
    intervalFunc()
    wsClient.on('message', function(rawMessage) {
        console.log('received: %s', rawMessage);
        try {
            const message = JSON.parse(rawMessage);
            clients[message.tokken] = wsClient;
            // db.find({tokken: message.tokken}, function (err, docs) {
            //     console.log(docs)
                
            //     if (docs.length > 0) {
            //         const id = docs[0]["_id"];
            //         console.log(id);
            //         clients[id] = wsClient;
            //     } else{
            //         db.insert({tokken : message.tokken});
            //         clients["id"] = wsClient;
            //         console.log("add new user")
            //     }
            // });
        } catch (error) {
            console.log('Ошибка', error);
        }
    })

    wsClient.on('close', function() {
    console.log('Пользователь отключился');
    })
}

console.log(`Сервер запущен на ${port} порту`);

function intervalFunc() {
    for (const id in clients) {
        datajs = require('./test.json');
        datajs["time"] += 1;
        clients[id].send(JSON.stringify(datajs))
        console.log("send data")
    }
}

// server.listen(port);

setInterval(intervalFunc, 10000);