const mqtt = require('mqtt')
const {MQTTRouter, emitter} = require('./routers/mqtt.routers.js')


class MQTTServer {
    
  async runMQTT (host = 'localhost', port = '1883', clientId = `Server`) {
    console.log('run')
    const connectUrl = `mqtt://${host}:${port}`
    const stations_id = ['3', '23223', '23121']
    const client = mqtt.connect(connectUrl, {
      clientId,
      clean: true,
      connectTimeout: 4000,
      username: 'fifthfloor',
      password: 'root',
      reconnectPeriod: 1000,
    })

    const subtopic = ['/stt', '/sens', '/guard']

    client.on('connect', () => {
      console.log('Connected')
      for (let j in subtopic) {
        for (let i in stations_id) {
                const topic = stations_id[i] + subtopic[j]
                client.subscribe([topic], () => {
                console.log(`Subscribe to topic ${topic}`)
            })
        }
      }
    })

    client.on('message', await this.onMessage)

    emitter.eventBus.on('Updated data', 
        async function (id, topic, data){
              client.publish(`${id}/${topic}`, data, { qos: 0, retain: false }, (error) => {
                    if (error) {console.log(error)}
              })
        })

        'Updated speaker'
  }


  async onMessage(topic, payload){

      const id = topic.split('/')[0]
      const endpoint = topic.split('/')[1]

      switch(endpoint) {
          case 'stt':
              await MQTTRouter.ParseStatus(id, payload.toString())
              break
          case 'sens':
              await MQTTRouter.ParseModuleMessage(id, payload.toString())
              break
          case 'guard':
              await MQTTRouter.ParseGuard(id, payload.toString())
              break
      }
    console.log('Received Message:', topic, payload.toString())
  }
  

}

mqttServer = new MQTTServer()
module.exports = {mqttServer, emitter}