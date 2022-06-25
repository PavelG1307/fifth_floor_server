const WebSocket = require('ws');
const {checkToken} = require('./authControl.js');
const UserControllers = require('./controllers/user.controllers.js');
const DeviceControllers = require('./controllers/device.controllers.js');
const mqtt = require('./mqtt.js')
const Emitter = require('./emitter.js')
const port = 8080;
const wsServer = new WebSocket.Server({port: port});

DeviceControllers.Emitter = Emitter;
wsServer.on('connection', onConnect);

function onConnect(wsClient) {
    console.log("New client");
    Emitter.on('getInfoFromBD 1', async function(){
        // wsClient.send(JSON.stringify(await DeviceControllers.getStatus(user.id)))
        console.log('update Status 1 ws')
    } ())

    wsClient.on('message', async function(rawMessage) {
        let message = JSON.parse(rawMessage)
        res = await answer(message)
        wsClient.send(JSON.stringify(res))
        
    })

    wsClient.on('close', function() {
        console.log('Пользователь отключился');
    })
}


async function answer(message) {
    const {token, type} = message
    user = await checkToken(token)
    if (!user && type != "SIGN IN" && type != "REGISTRATION") {
        return {error: "Token invalid"}
    } else {
        switch (type) {
            case "CONNECTED":
                return await DeviceControllers.getStatus(user.id)

            case "SIGN IN":
                return await UserControllers.getUser(message.login, message.password)

            case "REGISTRATION":
                return await UserControllers.createUser(message.login, message.password, message.email, message.phone_number)
            
            case "GET STATUS":
                return await DeviceControllers.getStatus(user.id)
            
            case "ADD STATION":
                return await DeviceControllers.addStation(user.id, message.key)
            default:
                return {error: "Bad request"}
        }
    }
}

wsServer.on('listening', () => {console.log(`Сервер запущен на ${port} порту`)});
mqtt.runMQTT()