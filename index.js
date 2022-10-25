const WebSocket = require("ws");
const axios = require("axios");

const GAMESERVER_ID = process.env.GAMESERVER_ID || 0;
const TOKEN = process.env.TOKEN || "";

const requestNitradoAPI = async (gameServerId, token) => {
    //console.log(token)
    const data = await axios.get(`https://api.nitrado.net/services/${gameServerId}/gameservers`, {
        headers: {
            "Authorization": "Bearer "+ token
        }
    })

    return data.data;
}



(async () => {

    //console.log(process.env)

    const data = await requestNitradoAPI(GAMESERVER_ID, TOKEN);

    if (data.status === "success") {
        console.log(JSON.stringify(data))
        const ws = new WebSocket(`wss://${data.data.gameserver.hostsystems.linux.servername}.gamedata.io:34882/docker?token=${TOKEN}&backbuffer=200&service=${GAMESERVER_ID}`)
        //console.log("test")
        ws.on("message", (data) => {
            const json = JSON.parse(data);
            console.log(json.msg)
        });
        process.stdin.pipe(require('split')()).on('data', (line) => ws.send(JSON.stringify({"command":line,"container":`${data.data.gameserver.username}-game`})))

    } else {
        console.log(data)
        process.exit(1)
    }


})()

