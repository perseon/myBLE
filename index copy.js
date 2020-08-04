require('dotenv').config()

const MQTT = require("async-mqtt");


const { createBluetooth } = require('node-ble') 
const { TEST_DEVICE, TEST_SERVICE, TEST_CHARACTERISTIC, TEST_NOTIFY_SERVICE, TEST_NOTIFY_CHARACTERISTIC } = process.env

async function main () {
  const { bluetooth, destroy } = createBluetooth()

  // get bluetooth adapter
  const adapter = await bluetooth.defaultAdapter()
  await adapter.startDiscovery()
  console.log('discovering')

  // get device and connect
  const device = await adapter.waitDevice(TEST_DEVICE)
  console.log('got device', await device.getAddress(), await device.getName())
  await device.connect()
  console.log('connected')

device.on('disconnect',()=>{setTimeout(()=>  device.connect(),3000)
});

  const gattServer = await device.gatt()

  // read write characteristic
//  const service1 = await gattServer.getPrimaryService(TEST_SERVICE)
//  const characteristic1 = await service1.getCharacteristic(TEST_CHARACTERISTIC)
//  await characteristic1.writeValue(Buffer.from('Hello world'))
//  const buffer = await characteristic1.readValue()
//  console.log('read', buffer, buffer.toString())

  // subscribe characteristic
  const service2 = await gattServer.getPrimaryService(TEST_NOTIFY_SERVICE)
  const characteristic2 = await service2.getCharacteristic(TEST_NOTIFY_CHARACTERISTIC)
  await characteristic2.startNotifications()
  await new Promise(done => {
    characteristic2.on('valuechanged', buffer => {
      console.log('subscription', buffer.toString())
      
      const client = MQTT.connect('mqtt://'+ process.env.THINGSBOARD_HOST,{

        username: process.env.ACCESS_TOKEN

      });

      const res = buffer.toString().split('|')

      client.on('connect', function () {

        const p1 = (process.env.BAR_TO_VOLT_PRESSURE_SENSOR1*(((res[1] * 3.3 ) / 4095)-process.env.ZERO_OFFSET_PRESSURE_SENSOR1)).toFixed(1);

        const p2 = (process.env.BAR_TO_VOLT_PRESSURE_SENSOR2*(((res[2] * 3.3 ) / 4095)-process.env.ZERO_OFFSET_PRESSURE_SENSOR2)).toFixed(1);

        const telemetry = `{\"t1\":${res[0]},\"p1\":${p1},\"p2\":${p2},\"f1\":${res[3] & 1 },\"f2\":${res[3] & 2 },\"f3\":${res[3] & 4 },\"f4\":${res[3] & 8 },\"f5\":${res[3] & 16 },\"f6\":${res[3] & 32 }}`

        client.publish('v1/devices/me/telemetry',telemetry);

        console.log('Telemetry published!');

        client.end();
      });

    })
  })

  await characteristic2.stopNotifications()
  destroy()
}



  
   main()
   .then(console.log)
   .catch(console.error)
  
